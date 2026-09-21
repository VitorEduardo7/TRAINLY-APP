-- =========================================================
-- TRAINLY APP - Schema Supabase (Postgres)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (supabase.com -> seu projeto -> SQL Editor -> New query -> colar -> Run)
-- =========================================================

-- 1. PERFIS (estende auth.users, que o Supabase já cria sozinho)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  bio text,
  location text,
  avatar_url text,
  xp integer not null default 0,
  monthly_goal_km integer not null default 50,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Perfis são visíveis para qualquer usuário logado"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Usuário só edita o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Usuário insere o próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. ATIVIDADES (corridas, ciclismo, etc.)
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date timestamptz not null default now(),
  type text not null default 'Corrida' check (type in ('Corrida', 'Ciclismo', 'Natação', 'Caminhada')),
  title text,
  distance_km numeric(8,3) not null default 0,
  duration_sec integer not null default 0,
  heart_rate integer,
  elevation_m integer,
  xp_earned integer not null default 0,
  path jsonb, -- array de [lat, lon]
  created_at timestamptz not null default now()
);

alter table public.activities enable row level security;

create policy "Atividades visíveis para qualquer usuário logado"
  on public.activities for select
  using (auth.role() = 'authenticated');

create policy "Usuário só insere as próprias atividades"
  on public.activities for insert
  with check (auth.uid() = user_id);

create policy "Usuário só edita as próprias atividades"
  on public.activities for update
  using (auth.uid() = user_id);

create policy "Usuário só apaga as próprias atividades"
  on public.activities for delete
  using (auth.uid() = user_id);

-- Índice para consultas de histórico por usuário/data
create index if not exists activities_user_date_idx on public.activities (user_id, date desc);

-- 3. FUNÇÃO: soma de XP no perfil sempre que uma atividade é criada
create or replace function public.add_xp_after_activity()
returns trigger as $$
begin
  update public.profiles
    set xp = xp + new.xp_earned
    where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_activity_created on public.activities;
create trigger on_activity_created
  after insert on public.activities
  for each row execute procedure public.add_xp_after_activity();
