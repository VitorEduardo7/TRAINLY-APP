import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AchievementDefinition } from '../types/models';

export interface AchievementState extends AchievementDefinition {
  unlocked: boolean;
  unlockedAt: string | null;
}

/**
 * Catálogo de conquistas + quais o usuário (qualquer um, não só o logado —
 * dá pra ver as de um amigo no perfil dele) já desbloqueou. O desbloqueio em
 * si acontece no banco (gatilho `evaluate_achievements`, em
 * supabase/gamification_schema.sql) sempre que uma atividade nova é
 * registrada — aqui só lê o resultado.
 */
export function useAchievements(userId: string | undefined) {
  const [achievements, setAchievements] = useState<AchievementState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: defs, error: defErr }, { data: unlocked, error: unlockErr }] = await Promise.all([
      supabase.from('achievement_definitions').select('*').order('sort_order', { ascending: true }),
      supabase.from('user_achievements').select('achievement_id, unlocked_at').eq('user_id', userId),
    ]);

    if (defErr || unlockErr || !defs) {
      setError(true);
      setLoading(false);
      return;
    }

    const unlockedMap = new Map(((unlocked ?? []) as { achievement_id: string; unlocked_at: string }[]).map((u) => [
      u.achievement_id,
      u.unlocked_at,
    ]));

    setAchievements(
      (defs as AchievementDefinition[]).map((def) => ({
        ...def,
        unlocked: unlockedMap.has(def.id),
        unlockedAt: unlockedMap.get(def.id) ?? null,
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
