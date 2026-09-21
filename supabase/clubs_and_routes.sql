-- =========================================================
-- TRAINLY APP - Clubes, desafios e rotas (v2)
-- Rode este arquivo DEPOIS do schema.sql, no mesmo jeito:
-- SQL Editor -> New query -> colar -> Run.
--
-- Já rodou uma versão anterior deste arquivo (sem invite_code) e a tabela
-- "clubs" já existe? Rode só esta linha extra em vez do arquivo inteiro:
--   alter table public.clubs add column if not exists invite_code text
--     unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
-- =========================================================

-- 1. CLUBES ---------------------------------------------------------------
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- código curto pra convidar gente pro clube (ex: "2E0CA5C3"), igual ao site.
  -- Clube não aparece em nenhuma lista pública: só quem tem o código entra.
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.clubs enable row level security;

create policy "Clubes visíveis para qualquer usuário logado"
  on public.clubs for select
  using (auth.role() = 'authenticated');

create policy "Usuário logado pode criar clube"
  on public.clubs for insert
  with check (auth.uid() = created_by);

create policy "Só o criador edita o clube"
  on public.clubs for update
  using (auth.uid() = created_by);

create policy "Só o criador apaga o clube"
  on public.clubs for delete
  using (auth.uid() = created_by);

-- 2. MEMBROS DO CLUBE -------------------------------------------------------
create table if not exists public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

alter table public.club_members enable row level security;

create policy "Membros visíveis para qualquer usuário logado"
  on public.club_members for select
  using (auth.role() = 'authenticated');

create policy "Usuário entra no clube por conta própria"
  on public.club_members for insert
  with check (auth.uid() = user_id);

create policy "Usuário sai do clube por conta própria"
  on public.club_members for delete
  using (auth.uid() = user_id);

-- Ao criar um clube, o criador já entra automaticamente como admin
create or replace function public.handle_new_club()
returns trigger as $$
begin
  insert into public.club_members (club_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_club_created on public.clubs;
create trigger on_club_created
  after insert on public.clubs
  for each row execute procedure public.handle_new_club();

-- 3. DESAFIOS DO CLUBE -------------------------------------------------------
create table if not exists public.club_challenges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text,
  goal_km numeric(8,2) not null default 0,
  start_date date not null,
  end_date date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint club_challenges_dates_ck check (end_date >= start_date)
);

alter table public.club_challenges enable row level security;

create policy "Desafios visíveis para qualquer usuário logado"
  on public.club_challenges for select
  using (auth.role() = 'authenticated');

create policy "Só admin do clube cria desafio"
  on public.club_challenges for insert
  with check (
    exists (
      select 1 from public.club_members m
      where m.club_id = club_challenges.club_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

create policy "Só admin do clube apaga desafio"
  on public.club_challenges for delete
  using (
    exists (
      select 1 from public.club_members m
      where m.club_id = club_challenges.club_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

create index if not exists club_members_club_idx on public.club_members (club_id);
create index if not exists club_challenges_club_idx on public.club_challenges (club_id);

-- 4. ROTAS PÚBLICAS -----------------------------------------------------------
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  source_activity_id uuid references public.activities(id) on delete set null,
  name text not null,
  type text not null default 'Corrida' check (type in ('Corrida', 'Ciclismo', 'Caminhada')),
  difficulty text not null default 'Moderada' check (difficulty in ('Fácil', 'Moderada', 'Difícil')),
  terrain text,
  distance_km numeric(8,3) not null default 0,
  elevation_m integer,
  path jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.routes enable row level security;

create policy "Rotas visíveis para qualquer usuário logado"
  on public.routes for select
  using (auth.role() = 'authenticated');

create policy "Usuário só publica rota em seu nome"
  on public.routes for insert
  with check (auth.uid() = created_by);

create policy "Só quem criou edita a rota"
  on public.routes for update
  using (auth.uid() = created_by);

create policy "Só quem criou apaga a rota"
  on public.routes for delete
  using (auth.uid() = created_by);

create index if not exists routes_created_at_idx on public.routes (created_at desc);

-- =========================================================
-- v2.1 — já rodou este arquivo antes? Rode só o bloco abaixo (é seguro
-- rodar de novo, não duplica nada). Instala sozinho em bancos novos também.
--
-- Evita clube "órfão": se o admin sai (ou é o único admin e sai do clube)
-- e ninguém mais tem o papel de admin, promove automaticamente quem entrou
-- há mais tempo. Sem isso, um clube sem admin nunca mais consegue criar
-- desafios (a política de RLS exige admin pra isso).
-- =========================================================
create or replace function public.handle_admin_departure()
returns trigger as $$
declare
  next_admin record;
begin
  if old.role = 'admin' and not exists (
    select 1 from public.club_members where club_id = old.club_id and role = 'admin'
  ) then
    select club_id, user_id into next_admin
      from public.club_members
      where club_id = old.club_id
      order by joined_at asc
      limit 1;

    if next_admin.user_id is not null then
      update public.club_members
        set role = 'admin'
        where club_id = next_admin.club_id and user_id = next_admin.user_id;
    end if;
  end if;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists on_club_member_removed on public.club_members;
create trigger on_club_member_removed
  after delete on public.club_members
  for each row execute procedure public.handle_admin_departure();
