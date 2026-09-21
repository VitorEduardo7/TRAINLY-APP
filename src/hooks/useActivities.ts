import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, ActivityType } from '../types/models';
import { xpFromActivity } from '../lib/rank';

export function useActivities(userId: string | undefined) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (!err && data) {
      setActivities(data as Activity[]);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const createActivity = useCallback(
    async (input: {
      type: ActivityType;
      title?: string;
      distanceKm: number;
      durationSec: number;
      heartRate?: number | null;
      elevationM?: number | null;
      path?: [number, number][] | null;
      /** AAAA-MM-DD (opcional). Sem isso, o banco usa a data/hora atual. */
      date?: string | null;
    }) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const xpEarned = xpFromActivity(input.distanceKm, input.durationSec);
      const { error } = await supabase.from('activities').insert({
        user_id: userId,
        type: input.type,
        title: input.title ?? null,
        distance_km: input.distanceKm,
        duration_sec: input.durationSec,
        heart_rate: input.heartRate ?? null,
        elevation_m: input.elevationM ?? null,
        xp_earned: xpEarned,
        path: input.path ?? null,
        // Meio-dia (sem fuso explícito) em vez de meia-noite: evita que uma
        // data digitada pelo usuário "vire" o dia anterior ou seguinte só
        // por causa da diferença entre o fuso do aparelho e o do banco.
        ...(input.date ? { date: `${input.date}T12:00:00` } : {}),
      });
      if (error) throw error;
      await load();
      return xpEarned;
    },
    [userId, load],
  );

  return { activities, loading, error, reload: load, createActivity };
}

// Soma de km dos últimos 7 dias, por dia (pra montar o gráfico semanal)
export function weeklyVolume(activities: Activity[]) {
  const days: { label: string; km: number }[] = [];
  const today = new Date();
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const km = activities
      .filter((a) => new Date(a.date).toDateString() === day.toDateString())
      .reduce((sum, a) => sum + Number(a.distance_km), 0);
    days.push({ label: labels[day.getDay()], km });
  }
  return days;
}
