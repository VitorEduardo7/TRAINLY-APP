import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Profile } from '../types/models';

export interface UserProfileData {
  profile: Profile | null;
  activities: Activity[];
  /** Eu sigo essa pessoa. */
  isFollowing: boolean;
  /** Essa pessoa me segue (habilita o "Seguir de volta"). */
  followsMe: boolean;
  followerCount: number;
  followingCount: number;
}

const EMPTY: UserProfileData = {
  profile: null,
  activities: [],
  isFollowing: false,
  followsMe: false,
  followerCount: 0,
  followingCount: 0,
};

/**
 * Carrega o perfil público de outro atleta: dados do perfil, atividades (pra
 * calcular resumo/recordes), contagem de seguidores e a relação de "seguir"
 * nos dois sentidos — o `followsMe` é o que permite mostrar "Seguir de volta"
 * quando a pessoa já te segue, no mesmo estilo do Instagram.
 */
export function useUserProfile(targetId: string | undefined, currentUserId: string | undefined) {
  const [data, setData] = useState<UserProfileData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Contador de requisições: só a busca mais recente pode escrever no estado.
  // Sem isso, um "puxar pra atualizar" lento que termina DEPOIS de você tocar
  // em "Seguir" sobrescrevia o botão com o estado antigo (voltava pra
  // "Seguir" mesmo já seguindo).
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!targetId) return;
    const myRequest = ++requestId.current;
    setLoading(true);

    const [profileRes, activitiesRes, followersRes, followingRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', targetId).single(),
      supabase.from('activities').select('*').eq('user_id', targetId).order('date', { ascending: false }),
      // quem segue o alvo (pra contagem + saber se ele me segue)
      supabase.from('following').select('follower_id').eq('followed_id', targetId),
      // quem o alvo segue (pra contagem + saber se eu sou seguido por ele)
      supabase.from('following').select('followed_id').eq('follower_id', targetId),
    ]);

    // Chegou atrasada: já tem requisição mais nova em andamento (ou um
    // seguir/deixar de seguir aconteceu no meio) — descarta essa resposta.
    if (myRequest !== requestId.current) return;

    if (profileRes.error) {
      setError(true);
      setLoading(false);
      return;
    }
    setError(false);

    const followerIds = ((followersRes.data ?? []) as any[]).map((r) => r.follower_id as string);
    const followedIds = ((followingRes.data ?? []) as any[]).map((r) => r.followed_id as string);

    setData({
      profile: profileRes.data as Profile,
      activities: (activitiesRes.data ?? []) as Activity[],
      isFollowing: !!currentUserId && followerIds.includes(currentUserId),
      followsMe: !!currentUserId && followedIds.includes(currentUserId),
      followerCount: followerIds.length,
      followingCount: followedIds.length,
    });
    setLoading(false);
  }, [targetId, currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = useCallback(async () => {
    if (!targetId || !currentUserId || busy) return;
    const wasFollowing = data.isFollowing;

    // Invalida qualquer carregamento em voo: a resposta dele traria o estado
    // de "seguir" de antes desse toque e desfaria a atualização otimista.
    requestId.current++;

    // Otimista: o botão responde na hora e a contagem acompanha; se o
    // servidor recusar, recarrega tudo e volta ao estado real.
    setBusy(true);
    setData((prev) => ({
      ...prev,
      isFollowing: !wasFollowing,
      followerCount: Math.max(0, prev.followerCount + (wasFollowing ? -1 : 1)),
    }));

    const { error: err } = wasFollowing
      ? await supabase.from('following').delete().eq('follower_id', currentUserId).eq('followed_id', targetId)
      : await supabase.from('following').insert({ follower_id: currentUserId, followed_id: targetId });

    // 23505 = chave duplicada (já seguia). O estado otimista que acabamos de
    // aplicar já é o certo, então não precisa recarregar por causa disso.
    if (err && (err as any).code !== '23505') await load();
    setBusy(false);
  }, [targetId, currentUserId, busy, data.isFollowing, load]);

  return { ...data, loading, error, busy, reload: load, toggleFollow };
}
