-- =========================================================
-- TRAINLY APP - Guerra de Clã (Fase 7 do roteiro de gamificação)
-- Rode DEPOIS de schema.sql e clubs_and_routes.sql — usa `activities`,
-- `clubs` e `club_members`, não cria tabela nova nenhuma.
--
-- Sem pg_cron neste projeto (mesma filosofia de quests_schema.sql): a guerra
-- não tem uma tabela de estado própria com "início"/"fim" gravados. O fim de
-- semana atual e o placar são CALCULADOS na hora, direto de `activities`,
-- toda vez que alguém abre o ranking. Isso também significa que o resultado
-- de guerras passadas nunca se perde nem precisa de snapshot: dá pra
-- recalcular qualquer fim de semana já ocorrido a partir das atividades que
-- já existem (embora hoje só exponhamos a guerra atual/mais recente).
-- =========================================================

-- Sábado do fim de semana em que uma data (com hora) cai. extract(dow, ...)
-- do Postgres: 0=domingo .. 6=sábado. A conta "(dow+1) % 7" dá quantos dias
-- se passaram desde o sábado mais recente — funciona pra qualquer dia da
-- semana, não só sábado/domingo (ver `is_war_day` abaixo pra filtrar só os
-- dois dias que realmente contam pra guerra).
create or replace function public.war_saturday_of(p_ts timestamptz)
returns date
language sql immutable as $$
  select (p_ts::date) - ((extract(dow from p_ts)::int + 1) % 7)
$$;

-- Só sábado e domingo contam pra guerra — atividade de segunda a sexta não
-- soma ponto nenhum aqui (a guerra é especificamente um evento de fim de
-- semana, pra não virar "mais um ranking de XP" igual ao resto do app).
create or replace function public.is_war_day(p_ts timestamptz)
returns boolean
language sql immutable as $$
  select extract(dow from p_ts)::int in (0, 6)
$$;

-- Sábado da guerra "atual": a mais recente que já começou, hoje incluso.
-- Continua apontando pro mesmo sábado de segunda a sexta seguintes — é assim
-- que o placar do fim de semana que acabou de passar continua visível até a
-- próxima guerra abrir, em vez de sumir na segunda-feira.
create or replace function public.current_war_saturday()
returns date
language sql stable as $$
  select public.war_saturday_of(now())
$$;

-- Teto de XP que UM atleta pode contribuir pra guerra POR DIA (sábado ou
-- domingo, somando todas as atividades daquele dia). É o que normaliza a
-- disputa entre clubes:
--  - Sem teto, um clube com um membro "hiperativo" (ou testando o limite do
--    app com corridas fake em sequência) inflacionaria o placar sozinho.
--  - Também evita que clubes de cidades com mais opção de treino longo
--    larguem na frente só pela geografia — o teto acha um "dia bom de
--    treino", não o máximo fisicamente possível de registrar.
-- Calibrado bem acima do XP típico de UMA atividade (~80-160, ver rank.ts)
-- mas abaixo do que dá pra somar enfileirando várias atividades no mesmo dia.
create or replace function public.war_xp_cap_per_day()
returns integer
language sql immutable as $$ select 150 $$;

-- Ranking de clubes na guerra do fim de semana atual/mais recente: soma o XP
-- (já com o teto diário por atleta) de todo mundo que é membro de cada
-- clube. Só entram clubes com pelo menos 1 ponto (evita lista cheia de
-- zeros de clubes que nem competiram).
--
-- security definer porque soma XP de vários atletas de uma vez só, no banco
-- — mais eficiente que buscar atividade por atividade no app, igual ao que
-- já é feito em `useClubDetail.getLeaderboard` pros desafios de clube. Exige
-- um usuário autenticado (não é uma função pública sem login), mas mostra o
-- nome de QUALQUER clube com pontuação — de propósito: a graça de uma
-- guerra é a torcida entre clubes poder ver o placar geral, igual a tabela
-- `clubs` já é legível por qualquer logado (ver clubs_and_routes.sql).
create or replace function public.get_clan_war_leaderboard()
returns table(club_id uuid, club_name text, war_xp bigint, member_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;

  return query
    with war_day_totals as (
      -- XP por atleta por dia de guerra, já com o teto diário aplicado.
      select
        a.user_id,
        a.date::date as day,
        least(sum(a.xp_earned), public.war_xp_cap_per_day()) as day_xp
      from public.activities a
      where public.is_war_day(a.date)
        and public.war_saturday_of(a.date) = public.current_war_saturday()
      group by a.user_id, a.date::date
    ),
    war_totals as (
      select user_id, sum(day_xp) as war_xp
      from war_day_totals
      group by user_id
    )
    select
      c.id,
      c.name,
      coalesce(sum(wt.war_xp), 0)::bigint,
      count(distinct cm.user_id) filter (where wt.war_xp > 0)::bigint
    from public.clubs c
    join public.club_members cm on cm.club_id = c.id
    left join war_totals wt on wt.user_id = cm.user_id
    group by c.id, c.name
    having coalesce(sum(wt.war_xp), 0) > 0
    order by 3 desc, c.name asc;
end;
$$;

-- Detalhe de UM clube na guerra atual: XP de cada membro (com o mesmo teto
-- diário), do maior pro menor — "quem carregou o time". Só quem já é membro
-- do clube pode consultar (mesmo padrão de checagem de
-- `ensure_quests_for_period`/`get_current_quests` em quests_schema.sql: a
-- função é security definer e chamável direto pelo cliente via RPC, então
-- precisa validar auth.uid() ela mesma em vez de confiar na RLS, que ela
-- ignora).
create or replace function public.get_clan_war_members(p_club_id uuid)
returns table(user_id uuid, name text, avatar_url text, war_xp bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = auth.uid()
  ) then
    raise exception 'not allowed';
  end if;

  return query
    with war_day_totals as (
      select
        a.user_id,
        a.date::date as day,
        least(sum(a.xp_earned), public.war_xp_cap_per_day()) as day_xp
      from public.activities a
      where public.is_war_day(a.date)
        and public.war_saturday_of(a.date) = public.current_war_saturday()
      group by a.user_id, a.date::date
    ),
    war_totals as (
      select user_id, sum(day_xp) as war_xp
      from war_day_totals
      group by user_id
    )
    select
      p.id,
      p.name,
      p.avatar_url,
      coalesce(wt.war_xp, 0)::bigint
    from public.club_members cm
    join public.profiles p on p.id = cm.user_id
    left join war_totals wt on wt.user_id = p.id
    where cm.club_id = p_club_id
    order by 4 desc, p.name asc;
end;
$$;
