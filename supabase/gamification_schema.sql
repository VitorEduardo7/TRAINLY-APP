-- =========================================================
-- TRAINLY APP - Gamificação: motor de regras (Fase 1 do roteiro)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase,
-- DEPOIS de já ter rodado schema.sql (e avatars_storage.sql, se ainda
-- não rodou). Não conflita com nenhum dos dois — só cria tabelas e um
-- segundo gatilho em "activities", sem tocar no que já existe.
-- =========================================================

-- 1. DEFINIÇÕES DE CONQUISTAS ("catálogo"): o app lê daqui pra mostrar
--    ícone/título/descrição, e o motor de avaliação usa `category` + `params`
--    pra saber o que checar. Uma conquista nova entra com um INSERT, sem
--    precisar mexer em código do app nem do banco.
create table if not exists public.achievement_definitions (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null default 'trophy', -- nome do ícone (Ionicons)
  category text not null check (category in ('milestone', 'time_of_day', 'social')),
  xp_reward integer not null default 20,
  -- Parâmetros de cada tipo de checagem, ex.: {"count": 10}, {"distance_km": 50}
  -- ou {"start_hour": 18, "end_hour": 23}.
  params jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.achievement_definitions enable row level security;

create policy "Conquistas visíveis para qualquer usuário logado"
  on public.achievement_definitions for select
  using (auth.role() = 'authenticated');

-- 2. CONQUISTAS DESBLOQUEADAS POR USUÁRIO
create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievement_definitions(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

create policy "Conquistas de qualquer usuário são visíveis (perfil público)"
  on public.user_achievements for select
  using (auth.role() = 'authenticated');

-- Ninguém insere na mão pelo app — só o motor abaixo (roda como "security
-- definer", então não é bloqueado por essa política; ver add_xp_after_activity
-- em schema.sql, que já usa exatamente esse mesmo padrão).
create policy "Usuário não insere conquista diretamente"
  on public.user_achievements for insert
  with check (false);

create index if not exists user_achievements_user_idx on public.user_achievements (user_id);

-- 3. STREAK SEMANAL — fundação da Fase 2 do roteiro. Só a tabela por enquanto,
--    pra não precisar de outra migração depois; gatilho/lógica de "quebrar" ou
--    "congelar" streak entram junto com a Fase 2.
create table if not exists public.user_streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  freezes_available integer not null default 2,
  last_active_week date, -- segunda-feira da última semana com atividade válida
  updated_at timestamptz not null default now()
);

alter table public.user_streaks enable row level security;

create policy "Streak visível para qualquer usuário logado"
  on public.user_streaks for select
  using (auth.role() = 'authenticated');

-- 4. DESAFIOS DIÁRIOS/SEMANAIS — fundação da Fase 3. Só schema por enquanto.
create table if not exists public.quest_templates (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null default 'flag',
  period text not null check (period in ('daily', 'weekly')),
  goal_type text not null check (goal_type in ('distance_km', 'activity_count', 'duration_min')),
  goal_value numeric not null,
  xp_reward integer not null default 15,
  active boolean not null default true
);

alter table public.quest_templates enable row level security;

create policy "Modelos de desafio visíveis para qualquer usuário logado"
  on public.quest_templates for select
  using (auth.role() = 'authenticated');

create table if not exists public.user_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id text not null references public.quest_templates(id) on delete cascade,
  period_start date not null,
  progress numeric not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (user_id, quest_id, period_start)
);

alter table public.user_quests enable row level security;

create policy "Usuário só vê os próprios desafios"
  on public.user_quests for select
  using (auth.uid() = user_id);

-- 5. MOTOR DE AVALIAÇÃO — roda a cada atividade nova (depois do trigger de XP
--    que já existe, "on_activity_created"). Verifica conquistas de marco
--    (contagem/distância acumulada) e de horário (título por turno do dia) que
--    o usuário ainda não tem, e concede o XP de recompensa de cada uma —
--    valores pequenos de propósito (15 a 80), bem abaixo do XP de uma
--    atividade normal (~80 a 160), pra não inflar a curva de patente.
create or replace function public.evaluate_achievements()
returns trigger as $$
declare
  def record;
  total_count integer;
  total_km numeric;
  activity_hour integer;
begin
  select count(*), coalesce(sum(distance_km), 0)
    into total_count, total_km
    from public.activities
    where user_id = new.user_id;

  -- Hora "de verdade" só existe quando a atividade foi encerrada agora (o app
  -- manda a data manualmente, ao meio-dia, só quando a pessoa registra uma
  -- atividade de um dia passado — nesse caso nenhum título de turno bate, o
  -- que é o comportamento certo: evita destravar título só editando a data).
  activity_hour := extract(hour from new.date)::int;

  for def in
    select * from public.achievement_definitions d
    where not exists (
      select 1 from public.user_achievements ua
      where ua.user_id = new.user_id and ua.achievement_id = d.id
    )
  loop
    if def.category = 'milestone' and def.params ? 'count'
       and total_count >= (def.params->>'count')::int then
      insert into public.user_achievements (user_id, achievement_id) values (new.user_id, def.id)
        on conflict do nothing;
      update public.profiles set xp = xp + def.xp_reward where id = new.user_id;

    elsif def.category = 'milestone' and def.params ? 'distance_km'
       and total_km >= (def.params->>'distance_km')::numeric then
      insert into public.user_achievements (user_id, achievement_id) values (new.user_id, def.id)
        on conflict do nothing;
      update public.profiles set xp = xp + def.xp_reward where id = new.user_id;

    elsif def.category = 'time_of_day' and def.params ? 'start_hour' and def.params ? 'end_hour' then
      -- Suporta intervalo que cruza a meia-noite (ex.: 22h-2h), caso algum
      -- título futuro precise — os dois atuais (18h-23h e 0h-5h) não cruzam.
      if (def.params->>'start_hour')::int <= (def.params->>'end_hour')::int then
        if activity_hour between (def.params->>'start_hour')::int and (def.params->>'end_hour')::int then
          insert into public.user_achievements (user_id, achievement_id) values (new.user_id, def.id)
            on conflict do nothing;
          update public.profiles set xp = xp + def.xp_reward where id = new.user_id;
        end if;
      else
        if activity_hour >= (def.params->>'start_hour')::int or activity_hour <= (def.params->>'end_hour')::int then
          insert into public.user_achievements (user_id, achievement_id) values (new.user_id, def.id)
            on conflict do nothing;
          update public.profiles set xp = xp + def.xp_reward where id = new.user_id;
        end if;
      end if;
    end if;
  end loop;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_activity_evaluate_achievements on public.activities;
create trigger on_activity_evaluate_achievements
  after insert on public.activities
  for each row execute procedure public.evaluate_achievements();

-- 6. CATÁLOGO INICIAL — recompensas pequenas de propósito (ver comentário do
--    motor acima). `on conflict do nothing` deixa esse arquivo seguro pra
--    rodar de novo sem duplicar nem resetar quem já desbloqueou algo.
insert into public.achievement_definitions (id, title, description, icon, category, xp_reward, params, sort_order) values
  ('first_activity', 'Primeiro Passo', 'Registre sua primeira atividade.', 'footsteps', 'milestone', 15, '{"count": 1}', 1),
  ('activities_10', 'Consistência', 'Registre 10 atividades.', 'ribbon', 'milestone', 25, '{"count": 10}', 2),
  ('activities_50', 'Veterano', 'Registre 50 atividades.', 'medal', 'milestone', 40, '{"count": 50}', 3),
  ('activities_100', 'Centurião', 'Registre 100 atividades.', 'trophy', 'milestone', 60, '{"count": 100}', 4),
  ('distance_50', 'Primeiros 50km', 'Acumule 50km percorridos.', 'navigate', 'milestone', 20, '{"distance_km": 50}', 5),
  ('distance_250', 'Explorador', 'Acumule 250km percorridos.', 'map', 'milestone', 35, '{"distance_km": 250}', 6),
  ('distance_1000', 'Maratonista de Verdade', 'Acumule 1000km percorridos.', 'earth', 'milestone', 80, '{"distance_km": 1000}', 7),
  ('night_runner', 'Corredor Noturno', 'Complete uma atividade entre 18h e 23h.', 'moon', 'time_of_day', 20, '{"start_hour": 18, "end_hour": 23}', 8),
  ('early_bird', 'Da Madrugada', 'Complete uma atividade entre 0h e 5h.', 'partly-sunny', 'time_of_day', 30, '{"start_hour": 0, "end_hour": 5}', 9)
on conflict (id) do nothing;
