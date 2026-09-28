import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { StreakRow } from '../lib/streak';

/** Streak semanal de um usuário (o próprio, ou de outro — o perfil de
 *  qualquer pessoa mostra o foguinho dela). */
export function useStreak(userId: string | undefined) {
  const [streak, setStreak] = useState<StreakRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_streaks')
      .select('current_streak, longest_streak, freezes_available, last_active_week')
      .eq('user_id', userId)
      .maybeSingle();
    // Sem linha ainda (perfil criado antes da migração rodar, ou nunca
    // registrou atividade) — trata igual a "sem streak", não como erro.
    setStreak(!error && data ? (data as StreakRow) : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { streak, loading, reload: load };
}
