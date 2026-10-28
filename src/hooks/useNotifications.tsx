import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export type NotificationKind =
  | 'follow'
  | 'like'
  | 'comment'
  | 'post_like'
  | 'post_comment'
  | 'new_post'
  | 'new_challenge'
  | 'club_join';

export interface TrainlyNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  activityId?: string | null;
  activityTitle?: string | null;
  postId?: string | null;
  clubId?: string | null;
  clubName?: string | null;
  challengeTitle?: string | null;
  /** "fez 3 novas publicações" — o banco agrupa avisos repetidos. */
  count: number;
  read: boolean;
  createdAt: string;
}

const LAST_SEEN_KEY = 'trainly:notifications:lastSeenAt';
const LIMIT = 30;

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? '');
}

async function namesById(table: 'profiles' | 'activities' | 'clubs' | 'club_challenges', column: string, ids: (string | null)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!unique.length) return new Map<string, any>();
  const { data } = await supabase.from(table).select(`id, ${column}`).in('id', unique);
  return new Map(((data ?? []) as any[]).map((r) => [r.id, r]));
}

/**
 * Notificações — a MESMA tabela `notifications` do site (site_integration.sql).
 * Quem preenche são gatilhos do banco: alguém te seguiu, curtiu/comentou sua
 * publicação, um amigo publicou algo, novo desafio no seu clube, alguém
 * entrou no clube que você administra. Lido/não lido também fica no banco
 * (`read_at`), então ler no site zera o sininho do app e vice-versa.
 *
 * Plano B: num banco que ainda não rodou site_integration.sql (sem a
 * tabela), monta os avisos do jeito antigo — seguidores, curtidas e
 * comentários nas suas atividades — com o "lido" guardado no celular.
 */
function useNotificationsData(userId: string | undefined) {
  const [items, setItems] = useState<TrainlyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [legacy, setLegacy] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const legacyRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_SEEN_KEY).then(setLastSeenAt);
  }, []);

  const loadFromTable = useCallback(async (): Promise<TrainlyNotification[] | null> => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, actor_id, activity_id, post_id, club_id, challenge_id, item_count, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (error) {
      if (isMissingTable(error)) return null;
      throw error;
    }
    const rows = (data ?? []) as any[];
    const [actors, acts, clubs, challenges] = await Promise.all([
      namesById('profiles', 'name, avatar_url', rows.map((r) => r.actor_id)),
      namesById('activities', 'title, type', rows.map((r) => r.activity_id)),
      namesById('clubs', 'name', rows.map((r) => r.club_id)),
      namesById('club_challenges', 'title', rows.map((r) => r.challenge_id)),
    ]);
    return rows.map((r) => {
      const actor = actors.get(r.actor_id);
      const act = acts.get(r.activity_id);
      return {
        id: r.id,
        kind: r.type as NotificationKind,
        actorId: r.actor_id,
        actorName: actor?.name ?? 'Alguém',
        actorAvatarUrl: actor?.avatar_url ?? null,
        activityId: r.activity_id,
        activityTitle: act ? act.title || act.type : null,
        postId: r.post_id,
        clubId: r.club_id,
        clubName: clubs.get(r.club_id)?.name ?? null,
        challengeTitle: challenges.get(r.challenge_id)?.title ?? null,
        count: Number(r.item_count) || 1,
        read: r.read_at !== null,
        createdAt: r.created_at,
      };
    });
  }, [userId]);

  const loadLegacy = useCallback(async (): Promise<TrainlyNotification[]> => {
    if (!userId) return [];
    const { data: myActivities } = await supabase
      .from('activities')
      .select('id, title, type')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(50);
    const myActivityIds = ((myActivities ?? []) as any[]).map((a) => a.id);
    const activityById = new Map(((myActivities ?? []) as any[]).map((a) => [a.id, a]));
    const [followersRes, likesRes, commentsRes] = await Promise.all([
      supabase.from('following').select('follower_id, created_at').eq('followed_id', userId).order('created_at', { ascending: false }).limit(LIMIT),
      myActivityIds.length
        ? supabase.from('activity_likes').select('activity_id, user_id, created_at').in('activity_id', myActivityIds).neq('user_id', userId).limit(LIMIT)
        : Promise.resolve({ data: [] as any[] }),
      myActivityIds.length
        ? supabase.from('activity_comments').select('id, activity_id, user_id, created_at').in('activity_id', myActivityIds).neq('user_id', userId).limit(LIMIT)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const follows = (followersRes.data ?? []) as any[];
    const likes = (likesRes.data ?? []) as any[];
    const comments = (commentsRes.data ?? []) as any[];
    const actors = await namesById('profiles', 'name, avatar_url', [
      ...follows.map((r) => r.follower_id),
      ...likes.map((r) => r.user_id),
      ...comments.map((r) => r.user_id),
    ]);
    const base = (actorId: string) => ({
      actorId,
      actorName: actors.get(actorId)?.name ?? 'Atleta',
      actorAvatarUrl: actors.get(actorId)?.avatar_url ?? null,
      count: 1,
      read: false,
    });
    const titleOf = (id: string) => {
      const a = activityById.get(id);
      return a ? a.title || a.type : null;
    };
    return [
      ...follows.map((r) => ({ ...base(r.follower_id), id: `follow:${r.follower_id}`, kind: 'follow' as const, createdAt: r.created_at })),
      ...likes.map((r) => ({
        ...base(r.user_id),
        id: `like:${r.activity_id}:${r.user_id}`,
        kind: 'like' as const,
        activityId: r.activity_id,
        activityTitle: titleOf(r.activity_id),
        createdAt: r.created_at,
      })),
      ...comments.map((r) => ({
        ...base(r.user_id),
        id: `comment:${r.id}`,
        kind: 'comment' as const,
        activityId: r.activity_id,
        activityTitle: titleOf(r.activity_id),
        createdAt: r.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, LIMIT);
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const fromTable = legacyRef.current ? null : await loadFromTable();
      if (fromTable) {
        setItems(fromTable);
      } else {
        legacyRef.current = true;
        setLegacy(true);
        setItems(await loadLegacy());
      }
    } catch {
      // Rede ruim: mantém o que já estava na tela.
    } finally {
      setLoading(false);
    }
  }, [userId, loadFromTable, loadLegacy]);

  useEffect(() => {
    load();
  }, [load]);

  // Tempo real: o banco avisa na hora quando chega notificação nova pra mim
  // (site_integration.sql liga a tabela no "Realtime" do Supabase). Se o
  // Realtime não estiver disponível, nada quebra — só atualiza ao abrir a tela.
  useEffect(() => {
    if (!userId || legacy) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, legacy, load]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    if (legacyRef.current) {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SEEN_KEY, now);
      setLastSeenAt(now);
      return;
    }
    setItems((prev) => (prev.some((n) => !n.read) ? prev.map((n) => ({ ...n, read: true })) : prev));
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  }, [userId]);

  const unreadCount = useMemo(() => {
    if (!legacy) return items.filter((n) => !n.read).length;
    if (!lastSeenAt) return items.length;
    const seenMs = new Date(lastSeenAt).getTime();
    return items.filter((n) => new Date(n.createdAt).getTime() > seenMs).length;
  }, [items, legacy, lastSeenAt]);

  return { items, loading, unreadCount, reload: load, markAllRead };
}

type NotificationsContextValue = ReturnType<typeof useNotificationsData>;
const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * Uma instância só pra todo o app autenticado (ver RootNavigator) — sem isso,
 * cada tela com o sininho no cabeçalho dispararia sua própria busca toda vez
 * que ganhasse foco.
 */
export function NotificationsProvider({ userId, children }: { userId: string | undefined; children: React.ReactNode }) {
  const value = useNotificationsData(userId);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications precisa estar dentro de <NotificationsProvider>');
  }
  return ctx;
}
