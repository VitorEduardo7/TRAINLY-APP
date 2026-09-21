-- =========================================================
-- TRAINLY APP - Comentários nas atividades (v4)
-- Rode DEPOIS de schema.sql, clubs_and_routes.sql e social.sql:
-- SQL Editor -> New query -> colar -> Run.
--
-- Obs: o site (js/main.js) mostra um ícone "💬 0" no feed, mas é só
-- decorativo — não existe tabela nem endpoint de comentário no backend
-- PHP ainda. Esse arquivo cria o recurso do zero, só pro app por enquanto.
-- =========================================================

create table if not exists public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Resposta a outro comentário (opcional). Apagar o comentário original
  -- também apaga as respostas a ele (evita resposta "órfã" apontando pra
  -- um comentário que não existe mais).
  reply_to_id uuid references public.activity_comments(id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

alter table public.activity_comments enable row level security;

create policy "Comentários visíveis para qualquer usuário logado"
  on public.activity_comments for select
  using (auth.role() = 'authenticated');

create policy "Usuário comenta em nome próprio"
  on public.activity_comments for insert
  with check (auth.uid() = user_id);

-- Quem escreveu o comentário pode apagar o próprio comentário. O dono da
-- atividade (o "post") também pode apagar qualquer comentário nela —
-- moderação do próprio post, igual Instagram/Strava.
create policy "Autor do comentário ou dono do post apaga"
  on public.activity_comments for delete
  using (
    auth.uid() = user_id
    or auth.uid() = (select a.user_id from public.activities a where a.id = activity_comments.activity_id)
  );

create index if not exists activity_comments_activity_idx on public.activity_comments (activity_id, created_at);
