import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PickedImage, removeImageByUrl, uploadImage } from '../lib/photoUpload';
import { Post, PostComment } from '../types/models';

/**
 * Publicações (posts) — as MESMAS do site, nas tabelas `posts`, `post_likes`
 * e `post_comments` (criadas por supabase/site_integration.sql).
 *
 * Regras (aplicadas pelo próprio banco, RLS):
 * - só o autor e os AMIGOS dele veem uma publicação. "Amigo" = um segue o
 *   outro, em qualquer direção (função `are_friends` no banco);
 * - só amigos curtem e comentam; o autor apaga a publicação; quem escreveu o
 *   comentário ou o dono da publicação apagam um comentário.
 *
 * Atividades (treinos) NÃO têm mais curtida nem comentário — igual ao site,
 * a interação social acontece só nas publicações.
 */

const FEED_LIMIT = 30;

/** Erro de "tabela não existe": o banco ainda não rodou site_integration.sql. */
function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? '');
}

async function friendIdsOf(userId: string): Promise<Set<string>> {
  const [iFollow, followMe] = await Promise.all([
    supabase.from('following').select('followed_id').eq('follower_id', userId),
    supabase.from('following').select('follower_id').eq('followed_id', userId),
  ]);
  return new Set([
    ...((iFollow.data ?? []) as any[]).map((r) => r.followed_id as string),
    ...((followMe.data ?? []) as any[]).map((r) => r.follower_id as string),
  ]);
}

function mapComment(c: any, profiles: Map<string, any>): PostComment {
  const p = profiles.get(c.user_id);
  return {
    id: c.id,
    postId: c.post_id,
    userId: c.user_id,
    content: c.content,
    createdAt: c.created_at,
    authorName: p?.name ?? 'Atleta',
    authorAvatarUrl: p?.avatar_url ?? null,
  };
}

/** Junta curtidas, comentários e autores numa lista de publicações pronta pra tela. */
async function buildPosts(rows: any[], viewerId: string): Promise<Post[]> {
  if (!rows.length) return [];
  const ids = rows.map((p) => p.id);
  const [likesRes, commentsRes, friends] = await Promise.all([
    supabase.from('post_likes').select('post_id, user_id').in('post_id', ids),
    supabase
      .from('post_comments')
      .select('id, post_id, user_id, content, created_at')
      .in('post_id', ids)
      .order('created_at', { ascending: true }),
    friendIdsOf(viewerId),
  ]);
  const likes = (likesRes.data ?? []) as any[];
  const comments = (commentsRes.data ?? []) as any[];

  const profileIds = Array.from(new Set([...rows.map((p) => p.user_id), ...comments.map((c) => c.user_id)]));
  const { data: profileRows } = await supabase.from('profiles').select('id, name, avatar_url').in('id', profileIds);
  const profiles = new Map(((profileRows ?? []) as any[]).map((p) => [p.id, p]));

  return rows.map((p) => {
    const author = profiles.get(p.user_id);
    const postLikes = likes.filter((l) => l.post_id === p.id);
    const isMine = p.user_id === viewerId;
    return {
      id: p.id,
      userId: p.user_id,
      authorName: author?.name ?? 'Atleta',
      authorAvatarUrl: author?.avatar_url ?? null,
      content: p.content ?? null,
      photoUrl: p.photo_url ?? null,
      createdAt: p.created_at,
      likeCount: postLikes.length,
      likedByMe: postLikes.some((l) => l.user_id === viewerId),
      canInteract: isMine || friends.has(p.user_id),
      isMine,
      comments: comments.filter((c) => c.post_id === p.id).map((c) => mapComment(c, profiles)),
    };
  });
}

/**
 * Carrega uma lista de publicações (do feed ou de um perfil) e cuida das
 * ações de curtir, comentar e apagar. `fetchRows` diz QUAIS publicações.
 */
function usePostList(
  viewerId: string | undefined,
  fetchRows: () => PromiseLike<{ data: any[] | null; error: any }> | null,
  deps: unknown[],
) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [missingTable, setMissingTable] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!viewerId) return;
    const query = fetchRows();
    if (!query) return;
    const mine = ++requestId.current;
    setLoading(true);
    const { data, error: err } = await query;
    if (mine !== requestId.current) return;
    if (err) {
      setMissingTable(isMissingTable(err));
      setError(true);
      setLoading(false);
      return;
    }
    const built = await buildPosts((data ?? []) as any[], viewerId);
    if (mine !== requestId.current) return;
    setMissingTable(false);
    setError(false);
    setPosts(built);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerId, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLike = useCallback(
    async (post: Post) => {
      if (!viewerId || !post.canInteract) return;
      // Otimista: a tela muda na hora; se o banco recusar, recarrega.
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) } : p,
        ),
      );
      const { error: err } = post.likedByMe
        ? await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', viewerId)
        : await supabase.from('post_likes').insert({ post_id: post.id, user_id: viewerId });
      if (err && err.code !== '23505') await load();
    },
    [viewerId, load],
  );

  const addComment = useCallback(
    async (post: Post, text: string) => {
      if (!viewerId) throw new Error('Usuário não autenticado');
      const content = text.trim();
      if (!content) throw new Error('Escreva um comentário.');
      if (content.length > 500) throw new Error('Comentário muito longo (máx. 500 caracteres).');
      const { data, error: err } = await supabase
        .from('post_comments')
        .insert({ post_id: post.id, user_id: viewerId, content })
        .select('id, post_id, user_id, content, created_at')
        .single();
      if (err) {
        throw new Error(
          err.code === '42501' ? 'Só amigos podem comentar nessa publicação.' : 'Não foi possível comentar agora.',
        );
      }
      const { data: me } = await supabase.from('profiles').select('id, name, avatar_url').eq('id', viewerId).single();
      const comment = mapComment(data, new Map([[viewerId, me]]));
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, comments: [...p.comments, comment] } : p)));
    },
    [viewerId],
  );

  const deleteComment = useCallback(async (post: Post, comment: PostComment) => {
    const { error: err } = await supabase.from('post_comments').delete().eq('id', comment.id);
    if (err) throw new Error('Não foi possível apagar o comentário.');
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, comments: p.comments.filter((c) => c.id !== comment.id) } : p)),
    );
  }, []);

  const deletePost = useCallback(async (post: Post) => {
    const { error: err } = await supabase.from('posts').delete().eq('id', post.id);
    if (err) throw new Error('Não foi possível apagar a publicação.');
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    await removeImageByUrl('post-photos', post.photoUrl);
  }, []);

  return { posts, setPosts, loading, error, missingTable, reload: load, toggleLike, addComment, deleteComment, deletePost };
}

/** Feed de amigos: minhas publicações + de quem eu sigo (igual ao site). */
export function usePostsFeed(userId: string | undefined, followingIds: Set<string>) {
  const authorKey = Array.from(followingIds).sort().join(',');
  const list = usePostList(
    userId,
    () =>
      userId
        ? supabase
            .from('posts')
            .select('*')
            .in('user_id', [userId, ...Array.from(followingIds)])
            .order('created_at', { ascending: false })
            .limit(FEED_LIMIT)
        : null,
    [authorKey],
  );
  const { setPosts } = list;

  const createPost = useCallback(
    async (text: string, image: PickedImage | null) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const content = text.trim();
      if (!content && !image) throw new Error('Escreva algo ou escolha uma foto pra publicar.');
      if (content.length > 2000) throw new Error('Publicação muito longa (máx. 2000 caracteres).');
      const photoUrl = image ? await uploadImage('post-photos', userId, image, 'post') : null;
      const { data, error } = await supabase
        .from('posts')
        .insert({ user_id: userId, content: content || null, photo_url: photoUrl })
        .select('*')
        .single();
      if (error) {
        await removeImageByUrl('post-photos', photoUrl);
        throw new Error(isMissingTable(error) ? 'O banco ainda não tem a tabela de publicações.' : 'Não foi possível publicar agora.');
      }
      const [post] = await buildPosts([data], userId);
      setPosts((prev) => [post, ...prev]);
    },
    [userId, setPosts],
  );

  return { ...list, createPost };
}

/** Publicações de um atleta (perfil). Pra quem não é amigo, o banco devolve a lista vazia. */
export function useUserPosts(targetId: string | undefined, viewerId: string | undefined) {
  return usePostList(
    viewerId,
    () =>
      targetId
        ? supabase.from('posts').select('*').eq('user_id', targetId).order('created_at', { ascending: false }).limit(FEED_LIMIT)
        : null,
    [targetId],
  );
}
