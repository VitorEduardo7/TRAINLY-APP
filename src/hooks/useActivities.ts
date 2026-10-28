import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, ActivityType } from '../types/models';
import { xpFromActivity } from '../lib/rank';
import { PickedImage, removeImageByUrl, uploadImage } from '../lib/photoUpload';

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
      /** Foto do treino (opcional) — vai pro bucket `activity-photos`, igual ao site. */
      photo?: PickedImage | null;
    }) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const xpEarned = xpFromActivity(input.distanceKm, input.durationSec);
      const photoUrl = input.photo ? await uploadImage('activity-photos', userId, input.photo, 'activity') : null;
      const { data, error } = await supabase.from('activities').insert({
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
        ...(photoUrl ? { photo_url: photoUrl } : {}),
      }).select('xp_earned').single();
      if (error) {
        await removeImageByUrl('activity-photos', photoUrl);
        throw error;
      }
      await load();
      // O XP que vale é o que o banco gravou (com o xp_seguro.sql instalado,
      // é o banco que calcula — mesma fórmula, mas a fonte da verdade é ele).
      return Number((data as any)?.xp_earned ?? xpEarned);
    },
    [userId, load],
  );

  /**
   * Editar um treino próprio (igual ao site): tipo, título, distância,
   * duração, FC, elevação e foto. O XP é recalculado com a mesma fórmula e o
   * banco ajusta o total do perfil pela diferença (site_integration.sql).
   * A data não muda, pra não bagunçar sequência e desafios já contados.
   */
  const updateActivity = useCallback(
    async (
      activity: Activity,
      input: {
        type: ActivityType;
        title?: string;
        distanceKm: number;
        durationSec: number;
        heartRate?: number | null;
        elevationM?: number | null;
        /** `undefined` = não mexe na foto; `null` = tira; imagem nova = troca. */
        photo?: PickedImage | null;
      },
    ) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const fields: Record<string, unknown> = {
        type: input.type,
        title: input.title?.trim() || null,
        distance_km: input.distanceKm,
        duration_sec: input.durationSec,
        heart_rate: input.heartRate ?? null,
        elevation_m: input.elevationM ?? null,
        xp_earned: xpFromActivity(input.distanceKm, input.durationSec),
      };
      let newPhotoUrl: string | null = null;
      if (input.photo) {
        newPhotoUrl = await uploadImage('activity-photos', userId, input.photo, 'activity');
        fields.photo_url = newPhotoUrl;
      } else if (input.photo === null) {
        fields.photo_url = null;
      }
      const { error } = await supabase.from('activities').update(fields).eq('id', activity.id).eq('user_id', userId);
      if (error) {
        await removeImageByUrl('activity-photos', newPhotoUrl);
        throw error;
      }
      if (input.photo !== undefined && activity.photo_url) await removeImageByUrl('activity-photos', activity.photo_url);
      await load();
    },
    [userId, load],
  );

  /** Excluir um treino próprio — o banco devolve o XP dele (site_integration.sql). */
  const deleteActivity = useCallback(
    async (activity: Activity) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const { error } = await supabase.from('activities').delete().eq('id', activity.id).eq('user_id', userId);
      if (error) throw error;
      await removeImageByUrl('activity-photos', activity.photo_url);
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
    },
    [userId],
  );

  return { activities, loading, error, reload: load, createActivity, updateActivity, deleteActivity };
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
