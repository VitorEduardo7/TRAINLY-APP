import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChallengeProgress, Club, ClubChallenge, ClubMember } from '../types/models';

// Lista de clubes do usuário. Clube não tem "descobrir" público — só entra
// quem tem o código de convite (igual ao site).
export function useClubs(userId: string | undefined) {
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data: memberships, error: err } = await supabase
      .from('club_members')
      .select('club:clubs(*)')
      .eq('user_id', userId);
    if (err) {
      setError(true);
      setLoading(false);
      return;
    }
    setError(false);
    const clubs = ((memberships ?? []) as any[]).map((m) => m.club).filter(Boolean) as Club[];
    clubs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setMyClubs(clubs);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const createClub = useCallback(
    async (name: string, description: string) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('clubs')
        .insert({ name, description: description || null, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      await load();
      return data as Club;
    },
    [userId, load],
  );

  // Entra num clube a partir do código de convite (ex: "2E0CA5C3").
  const joinByCode = useCallback(
    async (code: string) => {
      if (!userId) throw new Error('Usuário não autenticado');
      const cleanCode = code.trim().toUpperCase();
      if (!cleanCode) throw new Error('Digite o código do clube');

      const { data: club, error: findError } = await supabase
        .from('clubs')
        .select('id, name')
        .eq('invite_code', cleanCode)
        .maybeSingle();
      if (findError) throw findError;
      if (!club) throw new Error('Código inválido — confira com quem te convidou');

      const { error } = await supabase.from('club_members').insert({ club_id: club.id, user_id: userId });
      if (error) {
        if (error.code === '23505') throw new Error('Você já está nesse clube');
        throw error;
      }
      await load();
      return club as Club;
    },
    [userId, load],
  );

  return { myClubs, loading, error, reload: load, createClub, joinByCode };
}

// Detalhe de um clube: membros, desafios, entrar/sair, criar desafio e
// calcular o ranking de um desafio a partir das atividades já salvas.
export function useClubDetail(clubId: string | undefined, userId: string | undefined) {
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [challenges, setChallenges] = useState<ClubChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const isMember = members.some((m) => m.user_id === userId);
  const isAdmin = members.some((m) => m.user_id === userId && m.role === 'admin');

  const load = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    const [{ data: clubData }, { data: memberRows }, { data: challengeRows }] = await Promise.all([
      supabase.from('clubs').select('*').eq('id', clubId).single(),
      supabase
        .from('club_members')
        .select('club_id, user_id, role, joined_at, profile:profiles(id, name, avatar_url)')
        .eq('club_id', clubId),
      supabase.from('club_challenges').select('*').eq('club_id', clubId).order('start_date', { ascending: false }),
    ]);
    setClub((clubData as Club) ?? null);
    setMembers((memberRows ?? []) as unknown as ClubMember[]);
    setChallenges((challengeRows ?? []) as ClubChallenge[]);
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const joinThisClub = useCallback(async () => {
    if (!clubId || !userId) throw new Error('Dados inválidos');
    const { error } = await supabase.from('club_members').insert({ club_id: clubId, user_id: userId });
    if (error) throw error;
    await load();
  }, [clubId, userId, load]);

  const leaveThisClub = useCallback(async () => {
    if (!clubId || !userId) throw new Error('Dados inválidos');
    const { error } = await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId);
    if (error) throw error;
    await load();
  }, [clubId, userId, load]);

  const createChallenge = useCallback(
    async (input: { title: string; description?: string; goalKm: number; startDate: string; endDate: string }) => {
      if (!clubId || !userId) throw new Error('Dados inválidos');
      const { error } = await supabase.from('club_challenges').insert({
        club_id: clubId,
        title: input.title,
        description: input.description || null,
        goal_km: input.goalKm,
        start_date: input.startDate,
        end_date: input.endDate,
        created_by: userId,
      });
      if (error) throw error;
      await load();
    },
    [clubId, userId, load],
  );

  const getLeaderboard = useCallback(
    async (challenge: ClubChallenge): Promise<ChallengeProgress[]> => {
      const memberIds = members.map((m) => m.user_id);
      if (memberIds.length === 0) return [];

      const { data: activityRows } = await supabase
        .from('activities')
        .select('user_id, distance_km, date')
        .in('user_id', memberIds)
        .gte('date', challenge.start_date)
        .lte('date', `${challenge.end_date}T23:59:59`);

      const totals = new Map<string, number>();
      for (const row of (activityRows ?? []) as any[]) {
        totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + Number(row.distance_km));
      }

      const goalKm = Number(challenge.goal_km);
      return members
        .map((m) => {
          const km = totals.get(m.user_id) ?? 0;
          return {
            userId: m.user_id,
            name: m.profile?.name ?? 'Atleta',
            km,
            goalKm,
            pct: goalKm > 0 ? Math.min(999, Math.round((km / goalKm) * 100)) : 0,
          };
        })
        .sort((a, b) => b.km - a.km);
    },
    [members],
  );

  return {
    club,
    members,
    challenges,
    loading,
    isMember,
    isAdmin,
    reload: load,
    joinThisClub,
    leaveThisClub,
    createChallenge,
    getLeaderboard,
  };
}
