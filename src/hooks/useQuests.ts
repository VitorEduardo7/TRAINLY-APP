import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CurrentQuest } from '../types/models';

/**
 * Desafios de hoje + da semana atual, do próprio usuário logado (só existe
 * pra "eu" — diferente de conquistas/streak, desafio não é algo que se
 * mostra no perfil de outra pessoa). A chamada RPC também garante, do lado
 * do banco, que os desafios do período já foram sorteados antes de ler (ver
 * `get_current_quests` em supabase/quests_schema.sql).
 */
export function useQuests(userId: string | undefined) {
  const [quests, setQuests] = useState<CurrentQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error: err } = await supabase.rpc('get_current_quests', { p_user_id: userId });
    if (err || !data) {
      setError(true);
      setLoading(false);
      return;
    }
    setQuests(data as CurrentQuest[]);
    setError(false);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const daily = quests.filter((q) => q.period === 'daily');
  const weekly = quests.filter((q) => q.period === 'weekly');
  const completedCount = quests.filter((q) => q.completed).length;

  return { quests, daily, weekly, completedCount, total: quests.length, loading, error, reload: load };
}
