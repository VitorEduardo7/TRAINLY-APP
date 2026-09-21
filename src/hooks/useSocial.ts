import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ActivityComment, FeedActivity, SearchProfile } from '../types/models';

// Busca de atletas + seguir/deixar de seguir.
export function useFollowing(userId: string | undefined) {
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [searching, setSearching] = useState(false);

  // Ref espelhando `followingIds` pra `search` sempre ler o valor mais
  // recente sem precisar recriar a função a cada mudança (o que fazia uma
  // busca com debounce disparar carregando um `isFollowing` desatualizado
  // se o usuário seguisse alguém entre digitar e o debounce rodar).
  const followingIdsRef = useRef<Set<string>>(followingIds);
  useEffect(() => {
    followingIdsRef.current = followingIds;
  }, [followingIds]);

  const loadFollowing = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('following').select('followed_id').eq('follower_id', userId);
    const nextIds = new Set((data ?? []).map((r: any) => r.followed_id as string));
    setFollowingIds((prev) => {
      // Só troca a referência do Set se o conteúdo realmente mudou. Sem
      // isso, todo reload criava um Set NOVO mesmo com o mesmo conteúdo, o
      // que mudava a identidade de `useFeed` (que depende de followingIds),
      // que por sua vez mudava a identidade do callback do useFocusEffect
      // em FriendsScreen — e como o efeito roda de novo sempre que sua
      // referência muda enquanto a tela está em foco, isso virava um loop
      // infinito de recarregamento (era o bug do feed "travado carregando").
      if (prev.size === nextIds.size && Array.from(prev).every((id) => nextIds.has(id))) {
        return prev;
      }
      return nextIds;
    });
  }, [userId]);

  useEffect(() => {
    loadFollowing();
  }, [loadFollowing]);

  // Contador pra descartar resposta atrasada: digitando "ana" e depois
  // "anab", a busca por "ana" podia voltar por último e sobrescrever os
  // resultados certos de "anab".
  const searchId = useRef(0);

  const search = useCallback(
    async (query: string) => {
      if (!userId) return;
      const trimmed = query.trim();
      const mySearch = ++searchId.current;
      if (!trimmed) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .ilike('name', `%${trimmed}%`)
        .neq('id', userId)
        .limit(20);

      if (mySearch !== searchId.current) return; // chegou depois de uma busca mais nova

      setResults(
        ((data ?? []) as any[]).map((p) => ({
          id: p.id,
          name: p.name,
          avatar_url: p.avatar_url,
          isFollowing: followingIdsRef.current.has(p.id),
        })),
      );
      setSearching(false);
    },
    [userId],
  );

  // Mantém o botão dos resultados da busca em sincronia com quem eu sigo de
  // verdade. Sem isso, seguir alguém pela tela de perfil dele e voltar pra
  // busca deixava o resultado ainda mostrando "Seguir" — e tocar nele tentava
  // inserir a mesma linha de novo (o par follower/followed é chave primária).
  useEffect(() => {
    setResults((prev) => {
      if (prev.every((p) => p.isFollowing === followingIds.has(p.id))) return prev;
      return prev.map((p) => ({ ...p, isFollowing: followingIds.has(p.id) }));
    });
  }, [followingIds]);

  const follow = useCallback(
    async (targetId: string) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const { error } = await supabase.from('following').insert({ follower_id: userId, followed_id: targetId });
      // 23505 = chave duplicada: já seguia essa pessoa. Não é erro do ponto de
      // vista do usuário — o resultado desejado ("eu sigo") já é verdade.
      if (error && (error as any).code !== '23505') throw error;
      setFollowingIds((prev) => new Set(prev).add(targetId));
      setResults((prev) => prev.map((p) => (p.id === targetId ? { ...p, isFollowing: true } : p)));
    },
    [userId],
  );

  const unfollow = useCallback(
    async (targetId: string) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const { error } = await supabase.from('following').delete().eq('follower_id', userId).eq('followed_id', targetId);
      if (error) throw error;
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      setResults((prev) => prev.map((p) => (p.id === targetId ? { ...p, isFollowing: false } : p)));
    },
    [userId],
  );

  return { followingIds, results, searching, search, follow, unfollow, reload: loadFollowing };
}

// Feed de atividades de quem eu sigo (+ minhas próprias), com curtidas.
export function useFeed(userId: string | undefined, followingIds: Set<string>) {
  const [feed, setFeed] = useState<FeedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const authorIds = Array.from(new Set([userId, ...Array.from(followingIds)]));

    const COLUMNS = 'id, user_id, date, type, title, distance_km, duration_sec, elevation_m, xp_earned';

    let activities: any[] = [];

    // Primeiro tenta trazer o autor junto (1 requisição). Esse "embed" depende
    // da chave estrangeira activities.user_id -> profiles.id estar visível pro
    // PostgREST; se por algum motivo ela não resolver, o feed inteiro falhava e
    // aparecia "Não foi possível carregar o feed" mesmo com tudo no ar. Agora,
    // nesse caso, ele refaz a busca sem o embed e pega os nomes à parte.
    const withAuthor = await supabase
      .from('activities')
      .select(`${COLUMNS}, author:profiles(name, avatar_url)`)
      .in('user_id', authorIds)
      .order('date', { ascending: false })
      .limit(30);

    if (!withAuthor.error) {
      activities = (withAuthor.data ?? []) as any[];
    } else {
      const plain = await supabase
        .from('activities')
        .select(COLUMNS)
        .in('user_id', authorIds)
        .order('date', { ascending: false })
        .limit(30);

      if (plain.error) {
        setError(true);
        setLoading(false);
        return;
      }

      const rows = (plain.data ?? []) as any[];
      const { data: authorRows } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', authorIds);
      const authorById = new Map(((authorRows ?? []) as any[]).map((p) => [p.id, p]));
      activities = rows.map((a) => ({ ...a, author: authorById.get(a.user_id) ?? null }));
    }

    setError(false);

    const activityIds = activities.map((a) => a.id);

    const likesByActivity = new Map<string, { count: number; likedByMe: boolean }>();
    const commentCountByActivity = new Map<string, number>();
    if (activityIds.length > 0) {
      const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
        supabase.from('activity_likes').select('activity_id, user_id').in('activity_id', activityIds),
        supabase.from('activity_comments').select('activity_id').in('activity_id', activityIds),
      ]);
      for (const like of (likeRows ?? []) as any[]) {
        const entry = likesByActivity.get(like.activity_id) ?? { count: 0, likedByMe: false };
        entry.count += 1;
        if (like.user_id === userId) entry.likedByMe = true;
        likesByActivity.set(like.activity_id, entry);
      }
      for (const c of (commentRows ?? []) as any[]) {
        commentCountByActivity.set(c.activity_id, (commentCountByActivity.get(c.activity_id) ?? 0) + 1);
      }
    }

    setFeed(
      activities.map((a) => {
        const likeInfo = likesByActivity.get(a.id) ?? { count: 0, likedByMe: false };
        return {
          id: a.id,
          user_id: a.user_id,
          authorName: a.author?.name ?? 'Atleta',
          authorAvatarUrl: a.author?.avatar_url ?? null,
          date: a.date,
          type: a.type,
          title: a.title,
          distance_km: Number(a.distance_km),
          duration_sec: a.duration_sec,
          elevation_m: a.elevation_m,
          xp_earned: a.xp_earned,
          likeCount: likeInfo.count,
          likedByMe: likeInfo.likedByMe,
          commentCount: commentCountByActivity.get(a.id) ?? 0,
        } as FeedActivity;
      }),
    );
    setLoading(false);
  }, [userId, followingIds]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLike = useCallback(
    async (activity: FeedActivity) => {
      if (!userId) return;
      // otimista: atualiza a UI na hora, sem esperar o servidor responder
      setFeed((prev) =>
        prev.map((a) =>
          a.id === activity.id
            ? { ...a, likedByMe: !a.likedByMe, likeCount: a.likeCount + (a.likedByMe ? -1 : 1) }
            : a,
        ),
      );
      const { error } = activity.likedByMe
        ? await supabase.from('activity_likes').delete().eq('activity_id', activity.id).eq('user_id', userId)
        : await supabase.from('activity_likes').insert({ activity_id: activity.id, user_id: userId });
      if (error) await load(); // desfaz a atualização otimista se der erro
    },
    [userId, load],
  );

  return { feed, loading, error, reload: load, toggleLike };
}

// Comentários de uma atividade — carregado sob demanda quando o card do
// feed é expandido (não busca comentário de toda atividade de uma vez).
export function useComments(activityId: string | undefined, currentUserId: string | undefined, postOwnerId: string | undefined) {
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!activityId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('activity_comments')
      .select('id, activity_id, user_id, reply_to_id, body, created_at, author:profiles(name, avatar_url)')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });
    if (err) {
      setError(true);
      setLoading(false);
      return;
    }
    setError(false);
    setComments(
      ((data ?? []) as any[]).map((c) => ({
        id: c.id,
        activityId: c.activity_id,
        userId: c.user_id,
        replyToId: c.reply_to_id,
        body: c.body,
        createdAt: c.created_at,
        authorName: c.author?.name ?? 'Atleta',
        authorAvatarUrl: c.author?.avatar_url ?? null,
      })),
    );
    setLoading(false);
  }, [activityId]);

  const addComment = useCallback(
    async (body: string, replyToId?: string | null) => {
      if (!activityId || !currentUserId) throw new Error('Usuário não autenticado');
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Escreva algo pra comentar.');
      setPosting(true);
      try {
        const { error } = await supabase.from('activity_comments').insert({
          activity_id: activityId,
          user_id: currentUserId,
          reply_to_id: replyToId ?? null,
          body: trimmed,
        });
        if (error) throw error;
        await load();
      } finally {
        setPosting(false);
      }
    },
    [activityId, currentUserId, load],
  );

  const deleteComment = useCallback(async (commentId: string) => {
    const { error } = await supabase.from('activity_comments').delete().eq('id', commentId);
    if (error) throw error;
    // Respostas a esse comentário somem em cascata no banco — reflete o
    // mesmo aqui na hora, sem esperar recarregar.
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.replyToId !== commentId));
  }, []);

  const canDelete = useCallback(
    (comment: ActivityComment) => !!currentUserId && (comment.userId === currentUserId || postOwnerId === currentUserId),
    [currentUserId, postOwnerId],
  );

  return { comments, loading, error, posting, load, addComment, deleteComment, canDelete };
}
