-- =========================================================
-- TRAINLY APP - Seguir pessoas e curtidas (v3)
-- Rode DEPOIS do schema.sql e do clubs_and_routes.sql:
-- SQL Editor -> New query -> colar -> Run.
-- =========================================================

-- 1. SEGUIR PESSOAS ----------------------------------------------------------
create table if not exists public.following (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint following_not_self_ck check (follower_id <> followed_id)
);

alter table public.following enable row level security;

create policy "Quem segue quem é visível pra qualquer usuário logado"
  on public.following for select
  using (auth.role() = 'authenticated');

create policy "Usuário só segue alguém em nome próprio"
  on public.following for insert
  with check (auth.uid() = follower_id);

create policy "Usuário só deixa de seguir em nome próprio"
  on public.following for delete
  using (auth.uid() = follower_id);

create index if not exists following_follower_idx on public.following (follower_id);
create index if not exists following_followed_idx on public.following (followed_id);

-- 2. CURTIDAS EM ATIVIDADES ---------------------------------------------------
create table if not exists public.activity_likes (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.activity_likes enable row level security;

create policy "Curtidas visíveis pra qualquer usuário logado"
  on public.activity_likes for select
  using (auth.role() = 'authenticated');

create policy "Usuário só curte em nome próprio"
  on public.activity_likes for insert
  with check (auth.uid() = user_id);

create policy "Usuário só descurte em nome próprio"
  on public.activity_likes for delete
  using (auth.uid() = user_id);

create index if not exists activity_likes_activity_idx on public.activity_likes (activity_id);
