import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ClanWarClub, ClanWarMember } from '../types/models';

/** Ranking de TODOS os clubes na Guerra de Clã do fim de semana atual (ou do
 *  mais recente, se hoje já não for sábado/domingo — o placar continua
 *  visível até a próxima guerra abrir). O cálculo (com teto de XP por
 *  atleta/dia) é todo feito no banco — ver `get_clan_war_leaderboard` em
 *  supabase/clan_war_schema.sql. */
export function useClanWar() {
  const [clubs, setClubs] = useState<ClanWarClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('get_clan_war_leaderboard');
    if (err || !data) {
      setError(true);
      setLoading(false);
      return;
    }
    setClubs(data as ClanWarClub[]);
    setError(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { clubs, loading, error, reload: load };
}

/** Quanto XP cada membro de UM clube específico rendeu na guerra atual — só
 *  quem já é membro consegue consultar (checado no banco, não só no app). */
export function useClanWarMembers(clubId: string | undefined) {
  const [members, setMembers] = useState<ClanWarMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    const { data, error: err } = await supabase.rpc('get_clan_war_members', { p_club_id: clubId });
    if (err || !data) {
      setError(true);
      setLoading(false);
      return;
    }
    setMembers(data as ClanWarMember[]);
    setError(false);
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  return { members, loading, error, reload: load };
}
