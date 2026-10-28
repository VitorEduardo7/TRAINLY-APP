-- =========================================================
-- TRAINLY - Conquistas v2: muito mais conquistas, bem variadas
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, DEPOIS de:
--   schema.sql, social.sql, gamification_schema.sql, streak_schema.sql,
--   quests_schema.sql, clubs_and_routes.sql e site_integration.sql.
-- Pode rodar de novo quantas vezes quiser: não duplica nada e não tira
-- conquista de ninguém.
--
-- O que muda em relação ao motor antigo (gamification_schema.sql):
--   * As regras agora olham o HISTÓRICO inteiro da pessoa (não só a
--     atividade que acabou de entrar). Isso permite conquistas de esporte,
--     ritmo, sequência de dias, mês, social, clubes, rotas e desafios — e
--     também liberar na hora o que quem já usa o app merecia (fim do arquivo).
--   * Cada conquista tem um NÍVEL (bronze, prata, ouro, lendária) e pode ser
--     SECRETA (aparece como "???" até alguém desbloquear).
--   * O app consegue mostrar o PROGRESSO ("7 de 10") pela função
--     achievement_progress.
--   * Horário do dia usa o fuso de Brasília (antes usava UTC, 3h de diferença).
--   * Se o cálculo das conquistas der qualquer erro, ele é ignorado: nunca
--     impede de salvar um treino, seguir alguém ou publicar.
-- =========================================================

do $$
begin
  if to_regclass('public.posts') is null or to_regclass('public.user_streaks') is null
     or to_regclass('public.user_quests') is null or to_regclass('public.routes') is null then
    raise exception 'Rode antes: gamification_schema.sql, quests_schema.sql, clubs_and_routes.sql e site_integration.sql';
  end if;
end $$;

-- 1. CATÁLOGO: novas categorias, nível e "secreta" ------------------------
alter table public.achievement_definitions drop constraint if exists achievement_definitions_category_check;
alter table public.achievement_definitions add constraint achievement_definitions_category_check
  check (category in (
    'milestone',   -- Marcos (número de treinos)
    'distance',    -- Distância acumulada
    'single',      -- Num treino só (distância, tempo, subida)
    'speed',       -- Ritmo / velocidade
    'sports',      -- Esportes
    'time_of_day', -- Horário do dia
    'consistency', -- Constância (dias seguidos, mês, meta, sequência)
    'social',      -- Amigos e publicações
    'clubs',       -- Clubes e rotas
    'quests',      -- Desafios diários/semanais
    'secret'       -- Secretas
  ));

alter table public.achievement_definitions add column if not exists tier text not null default 'bronze';
alter table public.achievement_definitions drop constraint if exists achievement_definitions_tier_check;
alter table public.achievement_definitions add constraint achievement_definitions_tier_check
  check (tier in ('bronze', 'prata', 'ouro', 'lendaria'));
alter table public.achievement_definitions add column if not exists secret boolean not null default false;

-- 2. NÚMEROS DA PESSOA ------------------------------------------------------
-- Tudo que as regras precisam, calculado de uma vez num JSON. Ex.:
-- {"total_count": 12, "total_km": 84.3, "best_pace_5k": 5.7, "hours": {"6": 3}, ...}
create or replace function public.achievement_stats(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  s jsonb;
  extra jsonb;
begin
  -- Números das atividades. `live` = treino feito na hora (GPS, ou salvo até
  -- 3h depois do horário dele). Só esses contam pras conquistas de horário,
  -- pra ninguém ganhar "Da Madrugada" registrando um treino antigo.
  with a as (
    select type,
           distance_km::numeric as km,
           duration_sec,
           coalesce(elevation_m, 0) as elev,
           photo_url,
           (date at time zone tz) as lts,
           (path is not null or abs(extract(epoch from (created_at - date))) < 10800) as live
      from public.activities
     where user_id = p_user
  )
  select jsonb_build_object(
    'total_count',    count(*),
    'total_km',       coalesce(sum(km), 0),
    'max_km',         coalesce(max(km), 0),
    'max_minutes',    coalesce(max(duration_sec), 0) / 60.0,
    'max_elevation',  coalesce(max(elev), 0),
    -- ritmo em minutos por km (menor = mais rápido)
    'best_pace_5k',   min(duration_sec / 60.0 / km) filter (where type = 'Corrida' and km >= 5 and duration_sec > 0),
    'best_pace_10k',  min(duration_sec / 60.0 / km) filter (where type = 'Corrida' and km >= 10 and duration_sec > 0),
    -- velocidade média em km/h no pedal
    'best_bike_kmh',  max(km / (duration_sec / 3600.0)) filter (where type = 'Ciclismo' and km >= 10 and duration_sec > 0),
    'distinct_types', count(distinct type),
    'runs',     count(*) filter (where type = 'Corrida'),
    'run_km',   coalesce(sum(km) filter (where type = 'Corrida'), 0),
    'rides',    count(*) filter (where type = 'Ciclismo'),
    'ride_km',  coalesce(sum(km) filter (where type = 'Ciclismo'), 0),
    'swims',    count(*) filter (where type = 'Natação'),
    'swim_km',  coalesce(sum(km) filter (where type = 'Natação'), 0),
    'walks',    count(*) filter (where type = 'Caminhada'),
    'walk_km',  coalesce(sum(km) filter (where type = 'Caminhada'), 0),
    'weekend_count', count(*) filter (where extract(isodow from lts) in (6, 7)),
    'active_days',   count(distinct lts::date),
    'photos',        count(*) filter (where photo_url is not null),
    'friday13',      count(*) filter (where extract(day from lts) = 13 and extract(isodow from lts) = 5),
    'pi_run',        count(*) filter (where km between 3.13 and 3.15),
    -- dias do ano em que treinou, "MM-DD" (Natal, Ano Novo...)
    'days_md',       coalesce(jsonb_agg(distinct to_char(lts, 'MM-DD')), '[]'::jsonb),
    -- quantos treinos "na hora" em cada hora do dia: {"6": 4, "19": 2}
    'hours', coalesce((
      select jsonb_object_agg(h, c) from (
        select extract(hour from (x.date at time zone tz))::int as h, count(*) as c
          from public.activities x
         where x.user_id = p_user
           and (x.path is not null or abs(extract(epoch from (x.created_at - x.date))) < 10800)
         group by 1
      ) hh
    ), '{}'::jsonb)
  )
  into s
  from a;

  select jsonb_build_object(
    -- mais treinos num mesmo dia
    'max_same_day', coalesce((
      select max(c) from (
        select count(*) as c from public.activities
         where user_id = p_user group by (date at time zone tz)::date
      ) t
    ), 0),
    -- dias em que nadou, pedalou E correu
    'triathlon_days', (
      select count(*) from (
        select 1 from public.activities
         where user_id = p_user
         group by (date at time zone tz)::date
        having bool_or(type = 'Natação') and bool_or(type = 'Ciclismo') and bool_or(type = 'Corrida')
      ) t
    ),
    -- maior sequência de dias seguidos treinando ("ilhas" de datas)
    'max_consecutive_days', coalesce((
      select max(n) from (
        select count(*) as n from (
          select d, d - (row_number() over (order by d))::int as grp
            from (select distinct (date at time zone tz)::date as d
                    from public.activities where user_id = p_user) dd
        ) g group by grp
      ) t
    ), 0),
    -- mês com mais treinos
    'max_month_count', coalesce((
      select max(c) from (
        select count(*) as c from public.activities
         where user_id = p_user group by date_trunc('month', date at time zone tz)
      ) t
    ), 0),
    -- em quantos meses bateu a meta (pela meta que está configurada hoje)
    'goal_months', (
      select count(*)
        from (
          select count(*) as c,
                 sum(distance_km) as km,
                 sum(duration_sec) / 3600.0 as h
            from public.activities
           where user_id = p_user
           group by date_trunc('month', date at time zone tz)
        ) m
        join public.profiles p on p.id = p_user
       where (case coalesce(p.monthly_goal_type, 'km')
                when 'activities' then m.c
                when 'hours' then m.h
                else m.km end)
             >= coalesce(nullif(p.monthly_goal_value, 0), p.monthly_goal_km, 50)
    ),
    'best_streak', coalesce((
      select greatest(longest_streak, current_streak) from public.user_streaks where user_id = p_user
    ), 0),
    'following',        (select count(*) from public.following where follower_id = p_user),
    'followers',        (select count(*) from public.following where followed_id = p_user),
    'posts',            (select count(*) from public.posts where user_id = p_user),
    'post_photos',      (select count(*) from public.posts where user_id = p_user and photo_url is not null),
    'likes_received',   (select count(*) from public.post_likes l join public.posts p on p.id = l.post_id
                          where p.user_id = p_user and l.user_id <> p_user),
    'comments_made',    (select count(*) from public.post_comments where user_id = p_user),
    'clubs_joined',     (select count(*) from public.club_members where user_id = p_user),
    'clubs_created',    (select count(*) from public.clubs where created_by = p_user),
    'challenges_created', (select count(*) from public.club_challenges where created_by = p_user),
    'routes_published', (select count(*) from public.routes where created_by = p_user),
    'quests_completed', (select count(*) from public.user_quests where user_id = p_user and completed)
  )
  into extra;

  return s || extra;
end;
$$;

-- 3. VALOR DE UMA REGRA -----------------------------------------------------
-- params de cada conquista:
--   {"stat": "total_km", "gte": 100}        → precisa de 100 ou mais
--   {"stat": "best_pace_5k", "lte": 5}       → precisa de 5 ou menos (ritmo)
--   {"stat": "hour", "from": 5, "to": 6}     → treinos entre 5h e 6h59
--   {"stat": "day", "md": "12-25"}           → treinou no dia 25/12
create or replace function public.achievement_value(p_stats jsonb, p_params jsonb)
returns numeric
language plpgsql
immutable
as $$
declare
  f int;
  t int;
begin
  case p_params->>'stat'
    when 'hour' then
      f := (p_params->>'from')::int;
      t := (p_params->>'to')::int;
      return coalesce((
        select sum((p_stats->'hours'->>h::text)::numeric)
          from generate_series(0, 23) h
         where (f <= t and h between f and t) or (f > t and (h >= f or h <= t))
      ), 0);
    when 'day' then
      return case when (p_stats->'days_md') ? (p_params->>'md') then 1 else 0 end;
    else
      return (p_stats->>(p_params->>'stat'))::numeric;
  end case;
end;
$$;

-- Meta numérica da conquista (pra barra de progresso).
create or replace function public.achievement_target(p_params jsonb)
returns numeric
language sql
immutable
as $$
  select coalesce((p_params->>'gte')::numeric, (p_params->>'lte')::numeric, 1);
$$;

create or replace function public.achievement_reached(p_value numeric, p_params jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when p_params ? 'lte' then p_value is not null and p_value <= (p_params->>'lte')::numeric
    else coalesce(p_value, 0) >= public.achievement_target(p_params)
  end;
$$;

-- 4. MOTOR: libera o que a pessoa já alcançou e dá o XP de cada uma ----------
create or replace function public.evaluate_user_achievements(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  st jsonb;
  def record;
  inserted int;
  unlocked int := 0;
  bonus int := 0;
begin
  if p_user is null then
    return 0;
  end if;
  st := public.achievement_stats(p_user);

  for def in
    select d.* from public.achievement_definitions d
     where not exists (
       select 1 from public.user_achievements ua
        where ua.user_id = p_user and ua.achievement_id = d.id
     )
  loop
    if public.achievement_reached(public.achievement_value(st, def.params), def.params) then
      insert into public.user_achievements (user_id, achievement_id) values (p_user, def.id)
        on conflict do nothing;
      get diagnostics inserted = row_count;
      -- Só soma o XP se a linha entrou agora (evita XP em dobro).
      if inserted > 0 then
        unlocked := unlocked + 1;
        bonus := bonus + def.xp_reward;
      end if;
    end if;
  end loop;

  if bonus > 0 then
    update public.profiles set xp = xp + bonus where id = p_user;
  end if;
  return unlocked;
end;
$$;

-- 5. PROGRESSO pro app ("7 de 10") ----------------------------------------
create or replace function public.achievement_progress(p_user uuid)
returns table (achievement_id text, current numeric, target numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  st jsonb;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;
  st := public.achievement_stats(p_user);
  return query
    select d.id,
           public.achievement_value(st, d.params),
           public.achievement_target(d.params)
      from public.achievement_definitions d;
end;
$$;

revoke execute on function public.achievement_stats(uuid) from public, anon, authenticated;
revoke execute on function public.evaluate_user_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.achievement_progress(uuid) from public, anon;
grant execute on function public.achievement_progress(uuid) to authenticated;

-- 6. QUANDO RODAR: treino, seguir, publicar, curtir, comentar, clube, rota,
--    desafio, missão concluída, sequência atualizada.
create or replace function public.achievements_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    case tg_table_name
      when 'activities' then
        perform public.evaluate_user_achievements(new.user_id);
      when 'following' then
        perform public.evaluate_user_achievements(new.follower_id);
        perform public.evaluate_user_achievements(new.followed_id);
      when 'posts' then
        perform public.evaluate_user_achievements(new.user_id);
      when 'post_likes' then
        perform public.evaluate_user_achievements((select p.user_id from public.posts p where p.id = new.post_id));
      when 'post_comments' then
        perform public.evaluate_user_achievements(new.user_id);
      when 'club_members' then
        perform public.evaluate_user_achievements(new.user_id);
      when 'routes' then
        perform public.evaluate_user_achievements(new.created_by);
      when 'club_challenges' then
        perform public.evaluate_user_achievements(new.created_by);
      when 'user_quests' then
        if new.completed then
          perform public.evaluate_user_achievements(new.user_id);
        end if;
      when 'user_streaks' then
        perform public.evaluate_user_achievements(new.user_id);
      else
        null;
    end case;
  exception when others then
    -- Conquista nunca pode impedir a ação principal (salvar treino etc.).
    raise warning 'conquistas: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Tira o gatilho/motor antigo.
drop trigger if exists on_activity_evaluate_achievements on public.activities;
drop function if exists public.evaluate_achievements();

-- "zz" no nome: gatilhos do mesmo evento rodam em ordem alfabética, então
-- este roda DEPOIS do XP, da sequência e das missões já terem sido atualizados.
drop trigger if exists on_activity_zz_achievements on public.activities;
create trigger on_activity_zz_achievements
  after insert or update of type, distance_km, duration_sec, elevation_m, photo_url on public.activities
  for each row execute procedure public.achievements_on_change();

drop trigger if exists on_following_zz_achievements on public.following;
create trigger on_following_zz_achievements
  after insert on public.following for each row execute procedure public.achievements_on_change();

drop trigger if exists on_post_zz_achievements on public.posts;
create trigger on_post_zz_achievements
  after insert on public.posts for each row execute procedure public.achievements_on_change();

drop trigger if exists on_post_like_zz_achievements on public.post_likes;
create trigger on_post_like_zz_achievements
  after insert on public.post_likes for each row execute procedure public.achievements_on_change();

drop trigger if exists on_post_comment_zz_achievements on public.post_comments;
create trigger on_post_comment_zz_achievements
  after insert on public.post_comments for each row execute procedure public.achievements_on_change();

drop trigger if exists on_club_member_zz_achievements on public.club_members;
create trigger on_club_member_zz_achievements
  after insert on public.club_members for each row execute procedure public.achievements_on_change();

drop trigger if exists on_route_zz_achievements on public.routes;
create trigger on_route_zz_achievements
  after insert on public.routes for each row execute procedure public.achievements_on_change();

drop trigger if exists on_challenge_zz_achievements on public.club_challenges;
create trigger on_challenge_zz_achievements
  after insert on public.club_challenges for each row execute procedure public.achievements_on_change();

drop trigger if exists on_user_quest_zz_achievements on public.user_quests;
create trigger on_user_quest_zz_achievements
  after insert or update of completed on public.user_quests for each row execute procedure public.achievements_on_change();

drop trigger if exists on_user_streak_zz_achievements on public.user_streaks;
create trigger on_user_streak_zz_achievements
  after insert or update on public.user_streaks for each row execute procedure public.achievements_on_change();

-- 7. AS CONQUISTAS ---------------------------------------------------------
-- XP pequeno de propósito (15 a 250), pra não bagunçar a curva de patentes:
-- um treino comum já vale ~80 a 160 XP.
insert into public.achievement_definitions (id, title, description, icon, category, xp_reward, params, sort_order, tier, secret) values
  -- Marcos
  ('first_activity', 'Primeiro Passo', 'Registre sua primeira atividade.', 'footsteps', 'milestone', 15, '{"stat":"total_count","gte":1}', 101, 'bronze', false),
  ('activities_5', 'Pegando o Ritmo', 'Registre 5 atividades.', 'trending-up', 'milestone', 20, '{"stat":"total_count","gte":5}', 102, 'bronze', false),
  ('activities_10', 'Consistência', 'Registre 10 atividades.', 'ribbon', 'milestone', 25, '{"stat":"total_count","gte":10}', 103, 'bronze', false),
  ('activities_25', 'Rotina de Atleta', 'Registre 25 atividades.', 'fitness', 'milestone', 35, '{"stat":"total_count","gte":25}', 104, 'prata', false),
  ('activities_50', 'Veterano', 'Registre 50 atividades.', 'medal', 'milestone', 50, '{"stat":"total_count","gte":50}', 105, 'prata', false),
  ('activities_100', 'Centurião', 'Registre 100 atividades.', 'trophy', 'milestone', 80, '{"stat":"total_count","gte":100}', 106, 'ouro', false),
  ('activities_250', 'Incansável', 'Registre 250 atividades.', 'flame', 'milestone', 120, '{"stat":"total_count","gte":250}', 107, 'ouro', false),
  ('activities_500', 'Lenda Viva', 'Registre 500 atividades.', 'diamond', 'milestone', 200, '{"stat":"total_count","gte":500}', 108, 'lendaria', false),

  -- Distância acumulada
  ('distance_10', 'Primeiros 10 km', 'Acumule 10 km somando todos os treinos.', 'navigate', 'distance', 15, '{"stat":"total_km","gte":10}', 201, 'bronze', false),
  ('distance_50', 'Primeiros 50 km', 'Acumule 50 km somando todos os treinos.', 'map-outline', 'distance', 20, '{"stat":"total_km","gte":50}', 202, 'bronze', false),
  ('distance_100', 'Clube dos 100', 'Acumule 100 km.', 'ribbon-outline', 'distance', 30, '{"stat":"total_km","gte":100}', 203, 'prata', false),
  ('distance_250', 'Explorador', 'Acumule 250 km.', 'map', 'distance', 45, '{"stat":"total_km","gte":250}', 204, 'prata', false),
  ('distance_500', 'Desbravador', 'Acumule 500 km — mais que ir de São Paulo ao Rio.', 'trail-sign', 'distance', 70, '{"stat":"total_km","gte":500}', 205, 'ouro', false),
  ('distance_1000', 'Mil Quilômetros', 'Acumule 1.000 km.', 'earth', 'distance', 100, '{"stat":"total_km","gte":1000}', 206, 'ouro', false),
  ('distance_2500', 'Rodando o Mapa', 'Acumule 2.500 km.', 'globe', 'distance', 150, '{"stat":"total_km","gte":2500}', 207, 'lendaria', false),
  ('distance_5000', 'Além do Horizonte', 'Acumule 5.000 km.', 'planet', 'distance', 220, '{"stat":"total_km","gte":5000}', 208, 'lendaria', false),

  -- Num treino só
  ('single_5k', 'Primeiro 5K', 'Faça 5 km num treino só.', 'flag-outline', 'single', 20, '{"stat":"max_km","gte":5}', 301, 'bronze', false),
  ('single_10k', 'Dois Dígitos', 'Faça 10 km num treino só.', 'flag', 'single', 30, '{"stat":"max_km","gte":10}', 302, 'prata', false),
  ('single_21k', 'Meia Maratona', 'Faça 21,1 km num treino só.', 'medal', 'single', 60, '{"stat":"max_km","gte":21.1}', 303, 'ouro', false),
  ('single_42k', 'Maratonista', 'Faça 42,2 km num treino só.', 'trophy', 'single', 120, '{"stat":"max_km","gte":42.2}', 304, 'lendaria', false),
  ('single_100k', 'Centenário', 'Faça 100 km num treino só (pedal vale!).', 'bicycle', 'single', 100, '{"stat":"max_km","gte":100}', 305, 'ouro', false),
  ('single_60min', 'Uma Hora Cravada', 'Faça um treino de 1 hora ou mais.', 'timer', 'single', 25, '{"stat":"max_minutes","gte":60}', 306, 'bronze', false),
  ('single_120min', 'Resistência', 'Faça um treino de 2 horas ou mais.', 'hourglass', 'single', 45, '{"stat":"max_minutes","gte":120}', 307, 'prata', false),
  ('single_240min', 'Ultra', 'Faça um treino de 4 horas ou mais.', 'infinite', 'single', 100, '{"stat":"max_minutes","gte":240}', 308, 'ouro', false),
  ('climb_100', 'Subidinha', 'Suba 100 m de elevação num treino.', 'trending-up', 'single', 20, '{"stat":"max_elevation","gte":100}', 309, 'bronze', false),
  ('climb_500', 'Rei da Montanha', 'Suba 500 m de elevação num treino.', 'triangle', 'single', 50, '{"stat":"max_elevation","gte":500}', 310, 'prata', false),
  ('climb_1000', 'Escalador', 'Suba 1.000 m de elevação num treino.', 'podium', 'single', 100, '{"stat":"max_elevation","gte":1000}', 311, 'ouro', false),

  -- Ritmo e velocidade
  ('pace_6', 'Abaixo de 6', 'Corra 5 km ou mais num ritmo melhor que 6:00/km.', 'speedometer', 'speed', 30, '{"stat":"best_pace_5k","lte":6}', 401, 'bronze', false),
  ('pace_5', 'Abaixo de 5', 'Corra 5 km ou mais num ritmo melhor que 5:00/km.', 'flash', 'speed', 60, '{"stat":"best_pace_5k","lte":5}', 402, 'prata', false),
  ('pace_10k_5', 'Ritmo de Prova', 'Corra 10 km ou mais num ritmo melhor que 5:00/km.', 'stopwatch', 'speed', 100, '{"stat":"best_pace_10k","lte":5}', 403, 'ouro', false),
  ('pace_4', 'Foguete', 'Corra 5 km ou mais num ritmo melhor que 4:00/km.', 'rocket', 'speed', 150, '{"stat":"best_pace_5k","lte":4}', 404, 'lendaria', false),
  ('bike_25', 'Pedal Firme', 'Pedale 10 km ou mais com média acima de 25 km/h.', 'bicycle', 'speed', 40, '{"stat":"best_bike_kmh","gte":25}', 405, 'prata', false),
  ('bike_30', 'Contra o Vento', 'Pedale 10 km ou mais com média acima de 30 km/h.', 'thunderstorm', 'speed', 80, '{"stat":"best_bike_kmh","gte":30}', 406, 'ouro', false),

  -- Esportes
  ('sport_run', 'Primeira Corrida', 'Registre uma corrida.', 'footsteps', 'sports', 15, '{"stat":"runs","gte":1}', 501, 'bronze', false),
  ('sport_ride', 'Primeiro Pedal', 'Registre um treino de ciclismo.', 'bicycle', 'sports', 15, '{"stat":"rides","gte":1}', 502, 'bronze', false),
  ('sport_swim', 'Primeira Braçada', 'Registre um treino de natação.', 'water', 'sports', 15, '{"stat":"swims","gte":1}', 503, 'bronze', false),
  ('sport_walk', 'Primeira Caminhada', 'Registre uma caminhada.', 'walk', 'sports', 15, '{"stat":"walks","gte":1}', 504, 'bronze', false),
  ('all_sports', 'Multiatleta', 'Faça os 4 esportes: corrida, ciclismo, natação e caminhada.', 'layers', 'sports', 60, '{"stat":"distinct_types","gte":4}', 505, 'ouro', false),
  ('run_100', 'Corredor de Rua', 'Acumule 100 km correndo.', 'footsteps', 'sports', 50, '{"stat":"run_km","gte":100}', 506, 'prata', false),
  ('ride_500', 'Ciclista de Estrada', 'Acumule 500 km pedalando.', 'bicycle', 'sports', 80, '{"stat":"ride_km","gte":500}', 507, 'ouro', false),
  ('swim_10', 'Peixe', 'Registre 10 treinos de natação.', 'fish', 'sports', 50, '{"stat":"swims","gte":10}', 508, 'prata', false),
  ('swim_20k', 'Travessia', 'Acumule 20 km nadando.', 'boat', 'sports', 100, '{"stat":"swim_km","gte":20}', 509, 'ouro', false),
  ('walk_100', 'Andarilho', 'Acumule 100 km caminhando.', 'leaf', 'sports', 50, '{"stat":"walk_km","gte":100}', 510, 'prata', false),

  -- Horário do dia (só treinos feitos na hora)
  ('early_bird', 'Da Madrugada', 'Treine entre 0h e 4h59.', 'cloudy-night', 'time_of_day', 30, '{"stat":"hour","from":0,"to":4,"gte":1}', 601, 'prata', false),
  ('sunrise', 'Nascer do Sol', 'Treine entre 5h e 6h59.', 'sunny', 'time_of_day', 20, '{"stat":"hour","from":5,"to":6,"gte":1}', 602, 'bronze', false),
  ('lunch', 'Hora do Almoço', 'Treine entre 12h e 13h59.', 'restaurant', 'time_of_day', 20, '{"stat":"hour","from":12,"to":13,"gte":1}', 603, 'bronze', false),
  ('night_runner', 'Corredor Noturno', 'Treine entre 18h e 23h59.', 'moon', 'time_of_day', 20, '{"stat":"hour","from":18,"to":23,"gte":1}', 604, 'bronze', false),
  ('morning_10', 'Pessoa Matinal', 'Faça 10 treinos antes das 8h.', 'cafe', 'time_of_day', 50, '{"stat":"hour","from":0,"to":7,"gte":10}', 605, 'prata', false),
  ('night_10', 'Coruja', 'Faça 10 treinos depois das 20h.', 'telescope', 'time_of_day', 50, '{"stat":"hour","from":20,"to":23,"gte":10}', 606, 'prata', false),
  ('weekend_10', 'Guerreiro de Fim de Semana', 'Faça 10 treinos em sábados ou domingos.', 'calendar', 'time_of_day', 40, '{"stat":"weekend_count","gte":10}', 607, 'prata', false),

  -- Constância
  ('two_in_day', 'Dobradinha', 'Faça 2 treinos no mesmo dia.', 'repeat', 'consistency', 25, '{"stat":"max_same_day","gte":2}', 701, 'bronze', false),
  ('days_3', 'Três Seguidos', 'Treine 3 dias seguidos.', 'flame', 'consistency', 25, '{"stat":"max_consecutive_days","gte":3}', 702, 'bronze', false),
  ('days_7', 'Semana Perfeita', 'Treine 7 dias seguidos.', 'bonfire', 'consistency', 70, '{"stat":"max_consecutive_days","gte":7}', 703, 'ouro', false),
  ('days_30', '30 Dias Ativos', 'Treine em 30 dias diferentes.', 'calendar-number', 'consistency', 40, '{"stat":"active_days","gte":30}', 704, 'prata', false),
  ('days_100', '100 Dias Ativos', 'Treine em 100 dias diferentes.', 'calendar-number', 'consistency', 100, '{"stat":"active_days","gte":100}', 705, 'ouro', false),
  ('month_12', 'Mês Cheio', 'Faça 12 treinos no mesmo mês.', 'albums', 'consistency', 50, '{"stat":"max_month_count","gte":12}', 706, 'prata', false),
  ('month_20', 'Mês Insano', 'Faça 20 treinos no mesmo mês.', 'sparkles', 'consistency', 90, '{"stat":"max_month_count","gte":20}', 707, 'ouro', false),
  ('goal_1', 'Meta Batida', 'Bata sua meta do mês pela primeira vez.', 'checkmark-done', 'consistency', 40, '{"stat":"goal_months","gte":1}', 708, 'prata', false),
  ('goal_3', 'Tricampeão', 'Bata a meta do mês 3 vezes.', 'podium', 'consistency', 80, '{"stat":"goal_months","gte":3}', 709, 'ouro', false),
  ('streak_4', 'Um Mês de Sequência', 'Mantenha a sequência semanal por 4 semanas.', 'sync', 'consistency', 40, '{"stat":"best_streak","gte":4}', 710, 'prata', false),
  ('streak_12', 'Trimestre de Fogo', 'Mantenha a sequência semanal por 12 semanas.', 'shield-checkmark', 'consistency', 100, '{"stat":"best_streak","gte":12}', 711, 'ouro', false),
  ('streak_52', 'Um Ano Sem Parar', 'Mantenha a sequência semanal por 52 semanas.', 'star', 'consistency', 250, '{"stat":"best_streak","gte":52}', 712, 'lendaria', false),

  -- Social
  ('follow_1', 'Primeira Amizade', 'Siga um atleta.', 'person-add', 'social', 15, '{"stat":"following","gte":1}', 801, 'bronze', false),
  ('follow_10', 'Rede de Treino', 'Siga 10 atletas.', 'people', 'social', 30, '{"stat":"following","gte":10}', 802, 'prata', false),
  ('followers_10', 'Inspiração', 'Tenha 10 seguidores.', 'people-circle', 'social', 40, '{"stat":"followers","gte":10}', 803, 'prata', false),
  ('followers_50', 'Influencer Fitness', 'Tenha 50 seguidores.', 'megaphone', 'social', 100, '{"stat":"followers","gte":50}', 804, 'ouro', false),
  ('post_1', 'Primeira Publicação', 'Publique algo pros seus amigos.', 'newspaper', 'social', 15, '{"stat":"posts","gte":1}', 805, 'bronze', false),
  ('post_photo', 'Registro do Dia', 'Publique uma foto.', 'images', 'social', 15, '{"stat":"post_photos","gte":1}', 806, 'bronze', false),
  ('posts_20', 'Contador de Histórias', 'Faça 20 publicações.', 'chatbubbles', 'social', 50, '{"stat":"posts","gte":20}', 807, 'prata', false),
  ('likes_10', 'Curtido', 'Receba 10 curtidas nas suas publicações.', 'heart', 'social', 25, '{"stat":"likes_received","gte":10}', 808, 'bronze', false),
  ('likes_100', 'Queridinho da Galera', 'Receba 100 curtidas nas suas publicações.', 'heart-circle', 'social', 80, '{"stat":"likes_received","gte":100}', 809, 'ouro', false),
  ('comments_10', 'Bom de Papo', 'Comente 10 vezes em publicações.', 'chatbubble-ellipses', 'social', 25, '{"stat":"comments_made","gte":10}', 810, 'bronze', false),
  ('photos_10', 'Fotógrafo', 'Registre 10 treinos com foto.', 'camera', 'social', 30, '{"stat":"photos","gte":10}', 811, 'prata', false),

  -- Clubes e rotas
  ('club_join', 'Parte do Time', 'Entre num clube.', 'shield', 'clubs', 15, '{"stat":"clubs_joined","gte":1}', 901, 'bronze', false),
  ('clubs_3', 'Sociável', 'Participe de 3 clubes.', 'git-network', 'clubs', 40, '{"stat":"clubs_joined","gte":3}', 902, 'prata', false),
  ('club_create', 'Fundador', 'Crie um clube.', 'flag', 'clubs', 30, '{"stat":"clubs_created","gte":1}', 903, 'prata', false),
  ('challenge_create', 'Organizador', 'Crie um desafio no seu clube.', 'trophy-outline', 'clubs', 30, '{"stat":"challenges_created","gte":1}', 904, 'prata', false),
  ('route_1', 'Cartógrafo', 'Publique sua primeira rota.', 'location', 'clubs', 25, '{"stat":"routes_published","gte":1}', 905, 'bronze', false),
  ('routes_5', 'Guia Local', 'Publique 5 rotas.', 'compass', 'clubs', 60, '{"stat":"routes_published","gte":5}', 906, 'ouro', false),

  -- Desafios diários/semanais
  ('quest_1', 'Missão Cumprida', 'Complete um desafio diário ou semanal.', 'checkbox', 'quests', 15, '{"stat":"quests_completed","gte":1}', 1001, 'bronze', false),
  ('quest_10', 'Caçador de Missões', 'Complete 10 desafios.', 'list', 'quests', 40, '{"stat":"quests_completed","gte":10}', 1002, 'prata', false),
  ('quest_50', 'Mestre das Missões', 'Complete 50 desafios.', 'key', 'quests', 100, '{"stat":"quests_completed","gte":50}', 1003, 'ouro', false),

  -- Secretas (aparecem como "???" até alguém desbloquear)
  ('friday13', 'Sexta-feira 13', 'Treinou numa sexta-feira 13. Sem medo!', 'skull', 'secret', 30, '{"stat":"friday13","gte":1}', 1101, 'prata', true),
  ('christmas', 'Treino de Natal', 'Treinou no dia 25 de dezembro.', 'gift', 'secret', 30, '{"stat":"day","md":"12-25","gte":1}', 1102, 'prata', true),
  ('new_year', 'Ano Novo, Treino Novo', 'Treinou no dia 1º de janeiro.', 'balloon', 'secret', 30, '{"stat":"day","md":"01-01","gte":1}', 1103, 'prata', true),
  ('pi_run', 'Corrida do Pi', 'Fez exatamente 3,14 km num treino.', 'calculator', 'secret', 31, '{"stat":"pi_run","gte":1}', 1104, 'prata', true),
  ('triathlon', 'Triatleta', 'Nadou, pedalou e correu no mesmo dia.', 'medal', 'secret', 120, '{"stat":"triathlon_days","gte":1}', 1105, 'lendaria', true)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  category = excluded.category,
  xp_reward = excluded.xp_reward,
  params = excluded.params,
  sort_order = excluded.sort_order,
  tier = excluded.tier,
  secret = excluded.secret;

-- 8. LIBERA PRA QUEM JÁ USA O APP -------------------------------------------
-- Quem já tinha feito por merecer ganha agora (com o XP). Mostra quantas
-- conquistas foram liberadas no total.
select coalesce(sum(public.evaluate_user_achievements(id)), 0) as conquistas_liberadas
  from public.profiles;
