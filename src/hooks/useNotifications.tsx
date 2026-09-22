import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export type NotificationKind = 'follow' | 'like' | 'comment';

export interface TrainlyNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  activityId?: string;
  activityTitle?: string;
  createdAt: string;
}

const LAST_SEEN_KEY = 'trainly:notifications:lastSeenAt';
const LIMIT = 30;

/**
 * Não existe tabela de notificações no banco — em vez de criar uma (exigiria
 * rodar uma migração nova em cada Supabase de cada aparelho), as notificações
 * são montadas do que já existe: quem passou a te seguir, curtidas e
 * comentários nas SUAS atividades. "Lida"/"não lida" é local (AsyncStorage),
 * comparando a data do item com a última vez que a tela foi aberta.
 */
function useNotificationsData(userId: string | undefined) {
  const [items, setItems] = useState<TrainlyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LAST_SEEN_KEY).then(setLastSeenAt);
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data: myActivities } = await supabase
      .from('activities')
      .select('id, title, type')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(50);
    const myActivityIds = ((myActivities ?? []) as any[]).map((a) => a.id);
    const activityById = new Map(((myActivities ?? []) as any[]).map((a) => [a.id, a]));

    // Sem "embed" (join automático) de propósito: `following` tem DUAS chaves
    // estrangeiras pra profiles (follower_id e followed_id), então o
    // PostgREST não sabe sozinho qual delas usar e o pedido falharia. Busca
    // separada + junção manual pelos ids evita depender de nome de chave.
    const [followersRes, likesRes, commentsRes] = await Promise.all([
      supabase
        .from('following')
        .select('follower_id, created_at')
        .eq('followed_id', userId)
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      myActivityIds.length
        ? supabase
            .from('activity_likes')
            .select('activity_id, user_id, created_at')
            .in('activity_id', myActivityIds)
            .neq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(LIMIT)
        : Promise.resolve({ data: [] as any[] }),
      myActivityIds.length
        ? supabase
            .from('activity_comments')
            .select('id, activity_id, user_id, created_at')
            .in('activity_id', myActivityIds)
            .neq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(LIMIT)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const followRows = (followersRes.data ?? []) as any[];
    const likeRows = (likesRes.data ?? []) as any[];
    const commentRows = (commentsRes.data ?? []) as any[];

    const actorIds = Array.from(
      new Set([
        ...followRows.map((r) => r.follower_id),
        ...likeRows.map((r) => r.user_id),
        ...commentRows.map((r) => r.user_id),
      ]),
    );

    const actorById = new Map<string, { name: string; avatar_url: string | null }>();
    if (actorIds.length) {
      const { data: actors } = await supabase.from('profiles').select('id, name, avatar_url').in('id', actorIds);
      for (const a of (actors ?? []) as any[]) actorById.set(a.id, a);
    }
    const nameOf = (id: string) => actorById.get(id)?.name ?? 'Atleta';
    const avatarOf = (id: string) => actorById.get(id)?.avatar_url ?? null;
    const titleOf = (activityId: string) => {
      const a = activityById.get(activityId);
      return a?.title || a?.type;
    };

    const all: TrainlyNotification[] = [
      ...followRows.map((r) => ({
        id: `follow:${r.follower_id}:${r.created_at}`,
        kind: 'follow' as const,
        actorId: r.follower_id,
        actorName: nameOf(r.follower_id),
        actorAvatarUrl: avatarOf(r.follower_id),
        createdAt: r.created_at,
      })),
      ...likeRows.map((r) => ({
        id: `like:${r.activity_id}:${r.user_id}`,
        kind: 'like' as const,
        actorId: r.user_id,
        actorName: nameOf(r.user_id),
        actorAvatarUrl: avatarOf(r.user_id),
        activityId: r.activity_id,
        activityTitle: titleOf(r.activity_id),
        createdAt: r.created_at,
      })),
      ...commentRows.map((r) => ({
        id: `comment:${r.id}`,
        kind: 'comment' as const,
        actorId: r.user_id,
        actorName: nameOf(r.user_id),
        actorAvatarUrl: avatarOf(r.user_id),
        activityId: r.activity_id,
        activityTitle: titleOf(r.activity_id),
        createdAt: r.created_at,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setItems(all.slice(0, LIMIT));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SEEN_KEY, now);
    setLastSeenAt(now);
  }, []);

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) return items.length;
    const seenMs = new Date(lastSeenAt).getTime();
    return items.filter((n) => new Date(n.createdAt).getTime() > seenMs).length;
  }, [items, lastSeenAt]);

  return { items, loading, unreadCount, reload: load, markAllRead };
}

type NotificationsContextValue = ReturnType<typeof useNotificationsData>;
const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * Uma instância só pra todo o app autenticado (ver RootNavigator) — sem isso,
 * cada tela com o sininho no cabeçalho dispararia sua própria busca toda vez
 * que ganhasse foco.
 */
export function NotificationsProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: React.ReactNode;
}) {
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
