-- =========================================================
-- TRAINLY APP - Moderação de clubes + bloquear usuário (Fase 8 do roteiro
-- de gamificação)
-- Rode DEPOIS de schema.sql, clubs_and_routes.sql, social.sql,
-- comments.sql e clan_war_schema.sql — mexe nas políticas de todas essas
-- tabelas e recria funções da guerra de clã.
-- =========================================================

-- 1. SILENCIAR MEMBRO DE CLUBE -----------------------------------------------
-- "Silenciado" continua no clube, mas some dos rankings DO CLUBE (desafios e
-- Guerra de Clã) enquanto o estado ficar ligado — ferramenta do admin contra
-- suspeita de trapaça (ex: distância impossível) ou comportamento tóxico,
-- sem precisar expulsar a pessoa de cara. Não afeta nada fora do clube (XP
-- pessoal, patente, outros clubes).
alter table public.club_members add column if not exists silenced boolean not null default false;

-- Ação de admin: silencia/dessilencia um membro. RPC em vez de política de
-- UPDATE direta na tabela — mais fácil de auditar/validar num lugar só,
-- mesmo padrão de `ensure_quests_for_period` (security definer + checagem
-- manual de auth.uid(), já que ignora RLS).
create or replace function public.set_club_member_silenced(p_club_id uuid, p_user_id uuid, p_silenced boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'not allowed';
  end if;

  update public.club_members
    set silenced = p_silenced
    where club_id = p_club_id and user_id = p_user_id;
end;
$$;

-- 2. REMOVER MEMBRO (admin) --------------------------------------------------
-- Sair do clube por conta própria já existe (delete direto da própria linha,
-- RLS de clubs_and_routes.sql). Isso aqui é o admin removendo OUTRA pessoa —
-- também via RPC em vez de abrir uma política de delete "qualquer admin
-- apaga qualquer linha", pra manter a validação (não pode se auto-remover
-- por aqui) num único lugar.
create or replace function public.kick_club_member(p_club_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'not allowed';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'not allowed';
  end if;

  delete from public.club_members where club_id = p_club_id and user_id = p_user_id;
end;
$$;

-- 3. Guerra de Clã e desafios passam a ignorar membro silenciado ------------
-- Recria `get_clan_war_members` com uma coluna nova (`silenced`) — precisa
-- de DROP antes porque o Postgres não deixa mudar as colunas de retorno de
-- uma função só com CREATE OR REPLACE.
drop function if exists public.get_clan_war_members(uuid);

create or replace function public.get_clan_war_members(p_club_id uuid)
returns table(user_id uuid, name text, avatar_url text, war_xp bigint, silenced boolean)
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
      -- Silenciado nunca soma XP pro placar do clube, mesmo tendo treinado.
      case when cm.silenced then 0::bigint else coalesce(wt.war_xp, 0)::bigint end,
      cm.silenced
    from public.club_members cm
    join public.profiles p on p.id = cm.user_id
    left join war_totals wt on wt.user_id = p.id
    where cm.club_id = p_club_id
    order by 4 desc, p.name asc;
end;
$$;

-- `get_clan_war_leaderboard` mantém as mesmas 4 colunas, então CREATE OR
-- REPLACE basta — só o join com `war_totals` passa a ignorar silenciado.
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
      coalesce(sum(case when cm.silenced then 0 else wt.war_xp end), 0)::bigint,
      count(distinct cm.user_id) filter (where not cm.silenced and wt.war_xp > 0)::bigint
    from public.clubs c
    join public.club_members cm on cm.club_id = c.id
    left join war_totals wt on wt.user_id = cm.user_id
    group by c.id, c.name
    having coalesce(sum(case when cm.silenced then 0 else wt.war_xp end), 0) > 0
    order by 3 desc, c.name asc;
end;
$$;

-- 4. BLOQUEAR USUÁRIO ---------------------------------------------------------
-- Ação pessoal (nada a ver com clube): impede seguir um ao outro, comentar
-- ou curtir atividade um do outro. Não esconde perfil/atividades de quem
-- bloqueou — isso exigiria reabrir a política de SELECT de `profiles` e
-- `activities`, que hoje é "qualquer usuário logado vê" e é usada em telas
-- como Explorar/Clubes/rankings; mudar isso é um risco maior e fica de fora
-- desta v1 de propósito.
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self_ck check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

-- Só quem bloqueou vê a própria lista de bloqueios — diferente de
-- `following`/`clubs`, isso aqui não é público (ninguém precisa saber quem
-- bloqueou quem, só as duas pontas precisam saber que a interação está
-- fechada, o que já é garantido pelas políticas abaixo em cada tabela).
create policy "Só quem bloqueou vê o próprio bloqueio"
  on public.user_blocks for select
  using (auth.uid() = blocker_id);

create policy "Usuário só bloqueia em nome próprio"
  on public.user_blocks for insert
  with check (auth.uid() = blocker_id);

create policy "Usuário só desbloqueia em nome próprio"
  on public.user_blocks for delete
  using (auth.uid() = blocker_id);

-- Helper pra checar bloqueio nos DOIS sentidos, usado dentro de outras
-- políticas de RLS abaixo. security definer porque uma política de RLS em
-- `following`/`activity_comments`/`activity_likes` roda como QUEM ESTÁ
-- FAZENDO A AÇÃO, que só enxerga (pela política acima) os bloqueios em que
-- ELE é quem bloqueou — sem bypassar a RLS aqui, não daria pra detectar "a
-- outra pessoa me bloqueou". Só devolve um boolean, não vaza nenhuma linha.
create or replace function public.are_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  )
$$;

-- Bloquear alguém desfaz o "seguir" nos dois sentidos na hora — não faria
-- sentido continuar seguindo (ou sendo seguido por) quem acabou de bloquear.
create or replace function public.handle_new_block()
returns trigger as $$
begin
  delete from public.following
    where (follower_id = new.blocker_id and followed_id = new.blocked_id)
       or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_user_block_created on public.user_blocks;
create trigger on_user_block_created
  after insert on public.user_blocks
  for each row execute procedure public.handle_new_block();

-- Impede seguir alguém que bloqueou você ou que você bloqueou (nos dois
-- sentidos). Recria a política de insert de `following` (social.sql) com a
-- checagem extra.
drop policy if exists "Usuário só segue alguém em nome próprio" on public.following;
create policy "Usuário só segue alguém em nome próprio"
  on public.following for insert
  with check (auth.uid() = follower_id and not public.are_blocked(follower_id, followed_id));

-- Impede comentar na atividade de quem bloqueou você ou que você bloqueou.
drop policy if exists "Usuário comenta em nome próprio" on public.activity_comments;
create policy "Usuário comenta em nome próprio"
  on public.activity_comments for insert
  with check (
    auth.uid() = user_id
    and not public.are_blocked(
      user_id,
      (select a.user_id from public.activities a where a.id = activity_comments.activity_id)
    )
  );

-- Impede curtir atividade de quem bloqueou você ou que você bloqueou.
drop policy if exists "Usuário só curte em nome próprio" on public.activity_likes;
create policy "Usuário só curte em nome próprio"
  on public.activity_likes for insert
  with check (
    auth.uid() = user_id
    and not public.are_blocked(
      user_id,
      (select a.user_id from public.activities a where a.id = activity_likes.activity_id)
    )
  );
