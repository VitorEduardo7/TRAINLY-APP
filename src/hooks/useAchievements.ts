import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AchievementDefinition } from '../types/models';

export interface AchievementState extends AchievementDefinition {
  unlocked: boolean;
  unlockedAt: string | null;
  /** Valor atual da regra (ex: 84 km de 100). `null` sem o conquistas.sql. */
  current: number | null;
}

/**
 * Catálogo de conquistas + quais o usuário (qualquer um, não só o logado —
 * dá pra ver as de um amigo no perfil dele) já desbloqueou, e quanto falta
 * pras outras. Quem desbloqueia é o banco (supabase/conquistas.sql): roda
 * sozinho a cada treino, publicação, curtida, clube, rota, desafio... Aqui
 * só lê o resultado.
 */
export function useAchievements(userId: string | undefined) {
  const [achievements, setAchievements] = useState<AchievementState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: defs, error: defErr }, { data: unlocked, error: unlockErr }, progressRes] = await Promise.all([
      supabase.from('achievement_definitions').select('*').order('sort_order', { ascending: true }),
      supabase.from('user_achievements').select('achievement_id, unlocked_at').eq('user_id', userId),
      // Progresso ("7 de 10"). Num banco sem o conquistas.sql essa função não
      // existe — aí só não mostra a barra, o resto funciona igual.
      supabase.rpc('achievement_progress', { p_user: userId }),
    ]);

    if (defErr || unlockErr || !defs) {
      setError(true);
      setLoading(false);
      return;
    }

    const unlockedMap = new Map(
      ((unlocked ?? []) as { achievement_id: string; unlocked_at: string }[]).map((u) => [u.achievement_id, u.unlocked_at]),
    );
    const progressMap = new Map<string, number | null>(
      progressRes.error
        ? []
        : ((progressRes.data ?? []) as { achievement_id: string; current: number | string | null }[]).map((p) => [
            p.achievement_id,
            p.current == null ? null : Number(p.current),
          ]),
    );

    setAchievements(
      (defs as AchievementDefinition[]).map((def) => ({
        ...def,
        unlocked: unlockedMap.has(def.id),
        unlockedAt: unlockedMap.get(def.id) ?? null,
        current: progressMap.get(def.id) ?? null,
      })),
    );
    setError(false);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return { achievements, unlockedCount, total: achievements.length, loading, error, reload: load };
}
