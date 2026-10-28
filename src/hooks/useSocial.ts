import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SearchProfile } from '../types/models';

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
      // que mudava a identidade de `usePostsFeed` (que depende de followingIds),
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

export interface ActiveTodayFriend {
  id: string;
  name: string;
  avatarUrl: string | null;
  type: string;
  distanceKm: number;
}

export interface SuggestedAthlete {
  id: string;
  name: string;
  avatarUrl: string | null;
  location: string | null;
  kmMonth: number;
  mutualCount: number;
}

export interface WeeklyRankRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  weekKm: number;
  isMe: boolean;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Segunda-feira 00:00 desta semana (mesmo critério do site e do streak). */
function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

/**
 * O "resto" da página de amigos do site: quem treinou hoje, atletas
 * sugeridos (gente que você ainda não segue, sorteada) e o ranking da
 * semana em km entre você e quem você segue.
 */
export function useFriendsOverview(userId: string | undefined, followingIds: Set<string>) {
  const [activeToday, setActiveToday] = useState<ActiveTodayFriend[]>([]);
  const [suggested, setSuggested] = useState<SuggestedAthlete[]>([]);
  const [ranking, setRanking] = useState<WeeklyRankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const key = Array.from(followingIds).sort().join(',');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const followed = Array.from(followingIds);
    const rankIds = [userId, ...followed];
    const monthStart = startOfToday();
    monthStart.setDate(1);

    const [todayRes, weekRes, candidatesRes] = await Promise.all([
      followed.length
        ? supabase
            .from('activities')
            .select('user_id, type, distance_km, date')
            .in('user_id', followed)
            .gte('date', startOfToday().toISOString())
            .order('date', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('activities').select('user_id, distance_km').in('user_id', rankIds).gte('date', startOfWeek().toISOString()),
      supabase.from('profiles').select('id, name, avatar_url, location').neq('id', userId).limit(300),
    ]);

    // Sugestões: quem eu ainda não sigo, embaralhado, 8 por vez (igual ao site).
    const candidates = ((candidatesRes.data ?? []) as any[]).filter((p) => !followingIds.has(p.id));
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const picks = candidates.slice(0, 8);
    const pickIds = picks.map((p) => p.id);

    const profileIds = Array.from(
      new Set([...rankIds, ...((todayRes.data ?? []) as any[]).map((r) => r.user_id as string)]),
    );
    const [profilesRes, pickActsRes, pickFollowsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url').in('id', profileIds),
      pickIds.length
        ? supabase.from('activities').select('user_id, distance_km').in('user_id', pickIds).gte('date', monthStart.toISOString())
        : Promise.resolve({ data: [] as any[] }),
      pickIds.length
        ? supabase.from('following').select('follower_id, followed_id').in('follower_id', pickIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const profiles = new Map(((profilesRes.data ?? []) as any[]).map((p) => [p.id, p]));

    const seen = new Set<string>();
    const active: ActiveTodayFriend[] = [];
    for (const r of (todayRes.data ?? []) as any[]) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      const p = profiles.get(r.user_id);
      active.push({
        id: r.user_id,
        name: p?.name ?? 'Atleta',
        avatarUrl: p?.avatar_url ?? null,
        type: r.type ?? 'Corrida',
        distanceKm: Number(r.distance_km) || 0,
      });
    }

    const weekKm = new Map<string, number>(rankIds.map((id) => [id, 0]));
    for (const a of (weekRes.data ?? []) as any[]) weekKm.set(a.user_id, (weekKm.get(a.user_id) ?? 0) + Number(a.distance_km));
    const rank: WeeklyRankRow[] = rankIds
      .map((id) => ({
        id,
        name: profiles.get(id)?.name ?? 'Atleta',
        avatarUrl: profiles.get(id)?.avatar_url ?? null,
        weekKm: weekKm.get(id) ?? 0,
        isMe: id === userId,
      }))
      .sort((a, b) => b.weekKm - a.weekKm || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 10);

    const pickActs = (pickActsRes.data ?? []) as any[];
    const pickFollows = (pickFollowsRes.data ?? []) as any[];
    setSuggested(
      picks.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatar_url ?? null,
        location: p.location ?? null,
        kmMonth: pickActs.filter((a) => a.user_id === p.id).reduce((s, a) => s + Number(a.distance_km), 0),
        // Amigos em comum = gente que essa pessoa segue e eu também sigo.
        mutualCount: pickFollows.filter((f) => f.follower_id === p.id && followingIds.has(f.followed_id)).length,
      })),
    );
    setActiveToday(active);
    setRanking(rank);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key]);

  useEffect(() => {
    load();
  }, [load]);

  // Ao seguir alguém pela lista de sugestões, tira a pessoa da lista na hora.
  const dropSuggestion = useCallback((id: string) => setSuggested((prev) => prev.filter((p) => p.id !== id)), []);

  return { activeToday, suggested, ranking, loading, reload: load, dropSuggestion };
}
