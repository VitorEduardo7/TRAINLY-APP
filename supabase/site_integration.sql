-- =========================================================
-- TRAINLY - Integração SITE + APP no mesmo banco (v1)
--
-- Rode DEPOIS de todos os outros arquivos desta pasta (schema.sql,
-- avatars_storage.sql, clubs_and_routes.sql, social.sql, comments.sql,
-- gamification_schema.sql, streak_schema.sql, quests_schema.sql,
-- clan_war_schema.sql, clubs_moderation_schema.sql, cosmetics_schema.sql):
-- SQL Editor -> New query -> colar -> Run.
--
-- Só ADICIONA coisas (colunas, tabelas, gatilhos, buckets). Nada do que o
-- app já usa é apagado ou renomeado, então o app continua funcionando igual.
-- É seguro rodar de novo: não duplica nada.
-- =========================================================

-- 0. CONFERÊNCIA ---------------------------------------------------------------
-- Para logo no começo, com uma mensagem clara, se algum arquivo do app ainda
-- não foi rodado neste banco.
do $$
declare
  faltando text;
begin
  select string_agg(t, ', ') into faltando
  from unnest(array[
    'profiles', 'activities', 'activity_likes', 'activity_comments', 'following',
    'clubs', 'club_members', 'club_challenges', 'routes', 'user_blocks'
  ]) as t
  where to_regclass('public.' || t) is null;

  if faltando is not null then
    raise exception 'Faltam tabelas do app: %. Rode antes os outros arquivos .sql da pasta supabase do app.', faltando;
  end if;

  if to_regprocedure('public.are_blocked(uuid, uuid)') is null then
    raise exception 'Falta a função are_blocked. Rode antes o clubs_moderation_schema.sql.';
  end if;
end $$;


-- 1. PERFIL: campos que só o site tinha -----------------------------------------
-- Capa do perfil, meta do mês por tipo (km / atividades / horas) e a data do
-- último resgate da recompensa diária.
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists monthly_goal_type text not null default 'km';
alter table public.profiles add column if not exists monthly_goal_value numeric(10,2);
alter table public.profiles add column if not exists last_daily_reward date;

-- Quem já tinha meta em km no app continua com a mesma meta no site.
update public.profiles set monthly_goal_value = monthly_goal_km where monthly_goal_value is null;
alter table public.profiles alter column monthly_goal_value set default 50;
alter table public.profiles alter column monthly_goal_value set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_monthly_goal_type_ck') then
    alter table public.profiles add constraint profiles_monthly_goal_type_ck
      check (monthly_goal_type in ('km', 'activities', 'hours'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_monthly_goal_value_ck') then
    alter table public.profiles add constraint profiles_monthly_goal_value_ck
      check (monthly_goal_value > 0);
  end if;
end $$;

-- O app só conhece meta em km (`monthly_goal_km`); o site tem tipo + valor.
-- Este gatilho mantém os dois em sincronia, pra meta ser a mesma nos dois:
--   * app mudou a meta em km      -> vira meta do tipo "km" com esse valor
--   * site salvou meta do tipo km -> o app passa a mostrar esse valor
create or replace function public.sync_monthly_goal()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.monthly_goal_type = 'km' then
      new.monthly_goal_value := coalesce(new.monthly_goal_value, new.monthly_goal_km);
    end if;
    return new;
  end if;

  if new.monthly_goal_km is distinct from old.monthly_goal_km
     and new.monthly_goal_value is not distinct from old.monthly_goal_value
     and new.monthly_goal_type is not distinct from old.monthly_goal_type then
    new.monthly_goal_type := 'km';
    new.monthly_goal_value := new.monthly_goal_km;
  elsif new.monthly_goal_type = 'km'
     and (new.monthly_goal_value is distinct from old.monthly_goal_value
          or new.monthly_goal_type is distinct from old.monthly_goal_type) then
    new.monthly_goal_km := greatest(1, round(new.monthly_goal_value))::int;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_profile_goal_sync on public.profiles;
create trigger on_profile_goal_sync
  before insert or update on public.profiles
  for each row execute procedure public.sync_monthly_goal();


-- 2. ATIVIDADES: foto + XP ao editar/excluir --------------------------------------
alter table public.activities add column if not exists photo_url text;

-- O XP de uma atividade nova já é somado pelo gatilho do schema.sql. Faltava
-- o que o site faz: ao EDITAR, aplica a diferença; ao EXCLUIR, devolve o XP.
-- (O app não edita nem exclui atividades, então nada muda pra ele.)
create or replace function public.adjust_xp_after_activity_change()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles
      set xp = greatest(0, xp - coalesce(old.xp_earned, 0))
      where id = old.user_id;
    return old;
  end if;

  if new.xp_earned is distinct from old.xp_earned then
    update public.profiles
      set xp = greatest(0, xp + coalesce(new.xp_earned, 0) - coalesce(old.xp_earned, 0))
      where id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Sem "update OF xp_earned" de propósito: esse filtro só dispara quando o
-- UPDATE escreve a coluna, e não quando outro gatilho recalcula o XP
-- (xp_seguro.sql). A própria função confere se o XP mudou.
drop trigger if exists on_activity_xp_changed on public.activities;
create trigger on_activity_xp_changed
  after update on public.activities
  for each row execute procedure public.adjust_xp_after_activity_change();

drop trigger if exists on_activity_deleted_xp on public.activities;
create trigger on_activity_deleted_xp
  after delete on public.activities
  for each row execute procedure public.adjust_xp_after_activity_change();


-- 3. PUBLICAÇÕES (posts) -------------------------------------------------------
-- "Amigo" = existe follow em qualquer direção entre os dois (mesma regra do
-- site). Só amigos veem, curtem e comentam as publicações de alguém.
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable as $$
  select p_a is not null and p_b is not null and (
    p_a = p_b or exists (
      select 1 from public.following
      where (follower_id = p_a and followed_id = p_b)
         or (follower_id = p_b and followed_id = p_a)
    )
  )
$$;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text check (content is null or char_length(content) <= 2000),
  photo_url text,
  created_at timestamptz not null default now(),
  constraint posts_not_empty_ck check (nullif(btrim(coalesce(content, '')), '') is not null or photo_url is not null)
);

alter table public.posts enable row level security;

drop policy if exists "Publicações visíveis pro autor e amigos" on public.posts;
create policy "Publicações visíveis pro autor e amigos"
  on public.posts for select
  using (auth.uid() = user_id or public.are_friends(auth.uid(), user_id));

drop policy if exists "Usuário publica em nome próprio" on public.posts;
create policy "Usuário publica em nome próprio"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Só o autor edita a publicação" on public.posts;
create policy "Só o autor edita a publicação"
  on public.posts for update
  using (auth.uid() = user_id);

drop policy if exists "Só o autor apaga a publicação" on public.posts;
create policy "Só o autor apaga a publicação"
  on public.posts for delete
  using (auth.uid() = user_id);

create index if not exists posts_user_created_idx on public.posts (user_id, created_at desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "Curtidas de publicação visíveis pra usuário logado" on public.post_likes;
create policy "Curtidas de publicação visíveis pra usuário logado"
  on public.post_likes for select
  using (auth.role() = 'authenticated');

drop policy if exists "Só amigo curte publicação" on public.post_likes;
create policy "Só amigo curte publicação"
  on public.post_likes for insert
  with check (
    auth.uid() = user_id
    and public.are_friends(user_id, (select p.user_id from public.posts p where p.id = post_likes.post_id))
    and not public.are_blocked(user_id, (select p.user_id from public.posts p where p.id = post_likes.post_id))
  );

drop policy if exists "Usuário só descurte publicação em nome próprio" on public.post_likes;
create policy "Usuário só descurte publicação em nome próprio"
  on public.post_likes for delete
  using (auth.uid() = user_id);

create index if not exists post_likes_post_idx on public.post_likes (post_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) > 0 and char_length(content) <= 500),
  created_at timestamptz not null default now()
);

alter table public.post_comments enable row level security;

drop policy if exists "Comentários de publicação visíveis pra usuário logado" on public.post_comments;
create policy "Comentários de publicação visíveis pra usuário logado"
  on public.post_comments for select
  using (auth.role() = 'authenticated');

drop policy if exists "Só amigo comenta publicação" on public.post_comments;
create policy "Só amigo comenta publicação"
  on public.post_comments for insert
  with check (
    auth.uid() = user_id
    and public.are_friends(user_id, (select p.user_id from public.posts p where p.id = post_comments.post_id))
    and not public.are_blocked(user_id, (select p.user_id from public.posts p where p.id = post_comments.post_id))
  );

drop policy if exists "Autor do comentário ou da publicação apaga" on public.post_comments;
create policy "Autor do comentário ou da publicação apaga"
  on public.post_comments for delete
  using (
    auth.uid() = user_id
    or auth.uid() = (select p.user_id from public.posts p where p.id = post_comments.post_id)
  );

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);


-- 4. DESAFIOS DE CLUBE: tipo de métrica ------------------------------------------
-- O site mede desafios por km, nº de atividades, horas ou dias ativos. Os
-- desafios que já existem (criados pelo app) ficam como "km".
alter table public.club_challenges add column if not exists metric text not null default 'km';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'club_challenges_metric_ck') then
    alter table public.club_challenges add constraint club_challenges_metric_ck
      check (metric in ('km', 'activities', 'hours', 'days'));
  end if;
end $$;


-- 5. NOTIFICAÇÕES (uma tabela só, para site e app) --------------------------------
-- Preenchida só pelos gatilhos abaixo: ninguém consegue criar notificação
-- "na mão" pela API.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,   -- quem recebe
  actor_id uuid not null references public.profiles(id) on delete cascade,  -- quem fez a ação
  type text not null check (type in (
    'follow', 'like', 'comment', 'post_like', 'post_comment', 'new_post', 'new_challenge', 'club_join'
  )),
  activity_id uuid references public.activities(id) on delete cascade,
  comment_id uuid references public.activity_comments(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  post_comment_id uuid references public.post_comments(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  challenge_id uuid references public.club_challenges(id) on delete cascade,
  item_count integer not null default 1,  -- "fez 3 novas publicações"
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Usuário só vê as próprias notificações" on public.notifications;
create policy "Usuário só vê as próprias notificações"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Usuário marca as próprias notificações como lidas" on public.notifications;
create policy "Usuário marca as próprias notificações como lidas"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuário apaga as próprias notificações" on public.notifications;
create policy "Usuário apaga as próprias notificações"
  on public.notifications for delete
  using (auth.uid() = user_id);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- Cria uma notificação (ignora a própria ação: curtir a própria atividade
-- não avisa ninguém). Só os gatilhos usam; não fica liberada na API.
create or replace function public.create_notification(
  p_user uuid, p_actor uuid, p_type text,
  p_activity uuid default null, p_comment uuid default null,
  p_post uuid default null, p_post_comment uuid default null,
  p_club uuid default null, p_challenge uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_actor is null or p_user = p_actor then
    return;
  end if;
  insert into public.notifications
    (user_id, actor_id, type, activity_id, comment_id, post_id, post_comment_id, club_id, challenge_id)
  values
    (p_user, p_actor, p_type, p_activity, p_comment, p_post, p_post_comment, p_club, p_challenge);
end;
$$;

revoke execute on function public.create_notification(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

-- 5.1 Seguir / deixar de seguir
create or replace function public.notify_on_follow()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    perform public.create_notification(new.followed_id, new.follower_id, 'follow');
    return new;
  end if;
  delete from public.notifications
    where type = 'follow' and user_id = old.followed_id and actor_id = old.follower_id;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_following_notify on public.following;
create trigger on_following_notify
  after insert or delete on public.following
  for each row execute procedure public.notify_on_follow();

-- 5.2 Curtir / descurtir atividade
create or replace function public.notify_on_activity_like()
returns trigger as $$
declare
  dono uuid;
begin
  if tg_op = 'INSERT' then
    select user_id into dono from public.activities where id = new.activity_id;
    perform public.create_notification(dono, new.user_id, 'like', new.activity_id);
    return new;
  end if;
  delete from public.notifications
    where type = 'like' and activity_id = old.activity_id and actor_id = old.user_id;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_activity_like_notify on public.activity_likes;
create trigger on_activity_like_notify
  after insert or delete on public.activity_likes
  for each row execute procedure public.notify_on_activity_like();

-- 5.3 Comentário em atividade (apagar o comentário apaga o aviso: FK cascade)
create or replace function public.notify_on_activity_comment()
returns trigger as $$
declare
  dono uuid;
begin
  select user_id into dono from public.activities where id = new.activity_id;
  perform public.create_notification(dono, new.user_id, 'comment', new.activity_id, new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_activity_comment_notify on public.activity_comments;
create trigger on_activity_comment_notify
  after insert on public.activity_comments
  for each row execute procedure public.notify_on_activity_comment();

-- 5.4 Curtir / descurtir publicação
create or replace function public.notify_on_post_like()
returns trigger as $$
declare
  autor uuid;
begin
  if tg_op = 'INSERT' then
    select user_id into autor from public.posts where id = new.post_id;
    perform public.create_notification(autor, new.user_id, 'post_like', null, null, new.post_id);
    return new;
  end if;
  delete from public.notifications
    where type = 'post_like' and post_id = old.post_id and actor_id = old.user_id;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_post_like_notify on public.post_likes;
create trigger on_post_like_notify
  after insert or delete on public.post_likes
  for each row execute procedure public.notify_on_post_like();

-- 5.5 Comentário em publicação
create or replace function public.notify_on_post_comment()
returns trigger as $$
declare
  autor uuid;
begin
  select user_id into autor from public.posts where id = new.post_id;
  perform public.create_notification(autor, new.user_id, 'post_comment', null, null, new.post_id, new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_post_comment_notify on public.post_comments;
create trigger on_post_comment_notify
  after insert on public.post_comments
  for each row execute procedure public.notify_on_post_comment();

-- 5.6 Nova publicação: avisa os amigos MÚTUOS (um segue o outro). Se o amigo
-- ainda não leu o aviso anterior desse autor, só soma na contagem
-- ("fez 3 novas publicações") em vez de criar outro aviso.
create or replace function public.notify_on_new_post()
returns trigger as $$
declare
  amigo uuid;
  existente uuid;
begin
  for amigo in
    select f.followed_id
    from public.following f
    join public.following g on g.follower_id = f.followed_id and g.followed_id = f.follower_id
    where f.follower_id = new.user_id
  loop
    select id into existente
      from public.notifications
      where user_id = amigo and actor_id = new.user_id and type = 'new_post' and read_at is null
      order by created_at desc
      limit 1;

    if existente is not null then
      update public.notifications
        set item_count = item_count + 1, post_id = new.id, created_at = now()
        where id = existente;
    else
      perform public.create_notification(amigo, new.user_id, 'new_post', null, null, new.id);
    end if;
  end loop;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_post_created_notify on public.posts;
create trigger on_post_created_notify
  after insert on public.posts
  for each row execute procedure public.notify_on_new_post();

-- 5.7 Novo desafio no clube: avisa todos os membros, menos quem criou
create or replace function public.notify_on_new_challenge()
returns trigger as $$
begin
  insert into public.notifications (user_id, actor_id, type, club_id, challenge_id)
    select cm.user_id, new.created_by, 'new_challenge', new.club_id, new.id
    from public.club_members cm
    where cm.club_id = new.club_id and cm.user_id <> new.created_by;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_challenge_created_notify on public.club_challenges;
create trigger on_challenge_created_notify
  after insert on public.club_challenges
  for each row execute procedure public.notify_on_new_challenge();

-- 5.8 Alguém entrou no clube: avisa os administradores
create or replace function public.notify_on_club_join()
returns trigger as $$
begin
  insert into public.notifications (user_id, actor_id, type, club_id)
    select cm.user_id, new.user_id, 'club_join', new.club_id
    from public.club_members cm
    where cm.club_id = new.club_id and cm.role = 'admin' and cm.user_id <> new.user_id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_club_member_joined_notify on public.club_members;
create trigger on_club_member_joined_notify
  after insert on public.club_members
  for each row execute procedure public.notify_on_club_join();

-- 5.9 Primeira vez rodando: traz o que o app já mostrava (quem te segue,
-- curtidas e comentários nas suas atividades), já marcado como lido, pra
-- ninguém receber uma enxurrada de avisos antigos.
do $$
begin
  if not exists (select 1 from public.notifications) then
    insert into public.notifications (user_id, actor_id, type, read_at, created_at)
      select followed_id, follower_id, 'follow', now(), created_at
      from public.following;

    insert into public.notifications (user_id, actor_id, type, activity_id, read_at, created_at)
      select a.user_id, l.user_id, 'like', l.activity_id, now(), l.created_at
      from public.activity_likes l
      join public.activities a on a.id = l.activity_id
      where a.user_id <> l.user_id;

    insert into public.notifications (user_id, actor_id, type, activity_id, comment_id, read_at, created_at)
      select a.user_id, c.user_id, 'comment', c.activity_id, c.id, now(), c.created_at
      from public.activity_comments c
      join public.activities a on a.id = c.activity_id
      where a.user_id <> c.user_id;
  end if;
end $$;

-- Tempo real (o app pode ouvir avisos novos na hora). Só existe no Supabase;
-- em outro Postgres esse bloco não faz nada.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;


-- 6. FOTOS (Storage) ---------------------------------------------------------------
-- Antes as fotos ficavam na pasta uploads/ do PC que rodava o site. Agora vão
-- pro Storage do Supabase, então aparecem iguais no site e no app. Cada
-- pessoa só envia/troca/apaga arquivos dentro da própria pasta (<user_id>/...).
-- O avatar continua no bucket "avatars" que o app já usa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('activity-photos', 'activity-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-photos', 'post-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('covers', 'covers', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Trainly fotos: leitura pública" on storage.objects;
create policy "Trainly fotos: leitura pública"
  on storage.objects for select
  using (bucket_id in ('activity-photos', 'post-photos', 'covers'));

drop policy if exists "Trainly fotos: envia na própria pasta" on storage.objects;
create policy "Trainly fotos: envia na própria pasta"
  on storage.objects for insert
  with check (
    bucket_id in ('activity-photos', 'post-photos', 'covers')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Trainly fotos: troca na própria pasta" on storage.objects;
create policy "Trainly fotos: troca na própria pasta"
  on storage.objects for update
  using (
    bucket_id in ('activity-photos', 'post-photos', 'covers')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Trainly fotos: apaga na própria pasta" on storage.objects;
create policy "Trainly fotos: apaga na própria pasta"
  on storage.objects for delete
  using (
    bucket_id in ('activity-photos', 'post-photos', 'covers')
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- 7. RECOMPENSA DIÁRIA (+20 XP, uma vez por dia) -----------------------------------
-- Função no banco em vez de o site somar XP direto: assim ninguém resgata duas
-- vezes no mesmo dia nem escolhe quanto XP ganhar. O "dia" é o de Brasília.
create or replace function public.claim_daily_reward()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  novo_xp integer;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;

  update public.profiles
    set xp = xp + 20, last_daily_reward = hoje
    where id = auth.uid() and (last_daily_reward is null or last_daily_reward < hoje)
    returning xp into novo_xp;

  if novo_xp is null then
    raise exception 'already_claimed';
  end if;
  return novo_xp;
end;
$$;

revoke execute on function public.claim_daily_reward() from public, anon;
grant execute on function public.claim_daily_reward() to authenticated;
