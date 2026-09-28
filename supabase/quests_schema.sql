-- =========================================================
-- TRAINLY APP - Desafios diários e semanais (Fase 3 do roteiro)
-- Rode DEPOIS de gamification_schema.sql — usa as tabelas `quest_templates`
-- e `user_quests` que ele já cria. Este arquivo acrescenta: o catálogo de
-- desafios, a função que "sorteia" os desafios do dia/semana pra quem ainda
-- não tem, e o gatilho que avança o progresso a cada atividade nova.
-- =========================================================

-- 1. CATÁLOGO — igual às conquistas, um INSERT novo cria um desafio sem
--    mexer em código. XP calibrado baixo (8-40), bem abaixo do XP médio de
--    uma atividade (~80-160), mesma lógica de balanceamento da Fase 1.
insert into public.quest_templates (id, title, description, icon, period, goal_type, goal_value, xp_reward) values
  ('daily_log', 'Presença do dia', 'Registre 1 atividade hoje.', 'checkmark-circle', 'daily', 'activity_count', 1, 8),
  ('daily_2km', 'Corridinha rápida', 'Percorra 2km hoje.', 'walk', 'daily', 'distance_km', 2, 10),
  ('daily_15min', 'Quinze minutos', 'Treine por 15 minutos hoje.', 'time', 'daily', 'duration_min', 15, 10),
  ('daily_5km', 'Desafio do dia', 'Percorra 5km hoje.', 'flash', 'daily', 'distance_km', 5, 18),
  ('weekly_15km', 'Volume da semana', 'Acumule 15km essa semana.', 'navigate', 'weekly', 'distance_km', 15, 40),
  ('weekly_3act', 'Constância', 'Registre 3 atividades essa semana.', 'calendar', 'weekly', 'activity_count', 3, 35)
on conflict (id) do nothing;

-- 2. ATRIBUIÇÃO PREGUIÇOSA — sem `pg_cron` configurado neste projeto, os
--    desafios do período não são "sorteados" por um job em segundo plano;
--    são criados na hora, na primeira vez que o app pede. Idempotente: se a
--    pessoa já tem desafios pro dia/semana atual, não faz nada.
--
--    Segurança: chamável direto pelo app via `supabase.rpc(...)`, então
--    confere que `p_user_id` é sempre a própria pessoa logada — sem isso,
--    qualquer usuário autenticado poderia forçar a criação de desafios (ou,
--    pior, ler os de outra pessoa) passando o `id` de outro perfil. É o
--    mesmo motivo de toda escrita aqui rodar `security definer`: bypassa a
--    RLS de propósito, então a função precisa impor essa regra sozinha.
create or replace function public.ensure_quests_for_period(p_user_id uuid)
returns void as $$
declare
  today date := current_date;
  this_week date := date_trunc('week', now())::date;
  daily_count integer;
  weekly_count integer;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;

  select count(*) into daily_count
    from public.user_quests uq
    join public.quest_templates qt on qt.id = uq.quest_id
    where uq.user_id = p_user_id and qt.period = 'daily' and uq.period_start = today;

  if daily_count = 0 then
    insert into public.user_quests (user_id, quest_id, period_start)
    select p_user_id, id, today
      from public.quest_templates
      where period = 'daily' and active
      order by random()
      limit 3
    on conflict (user_id, quest_id, period_start) do nothing;
  end if;

  select count(*) into weekly_count
    from public.user_quests uq
    join public.quest_templates qt on qt.id = uq.quest_id
    where uq.user_id = p_user_id and qt.period = 'weekly' and uq.period_start = this_week;

  if weekly_count = 0 then
    insert into public.user_quests (user_id, quest_id, period_start)
    select p_user_id, id, this_week
      from public.quest_templates
      where period = 'weekly' and active
      order by random()
      limit 1
    on conflict (user_id, quest_id, period_start) do nothing;
  end if;
end;
$$ language plpgsql security definer;

-- 3. LEITURA — garante os desafios do período (função acima) e devolve só
--    os que valem AGORA (diários de hoje + o semanal desta semana), já
--    junto com os dados do catálogo, prontos pra tela. O app faz uma
--    chamada só (`supabase.rpc('get_current_quests', ...)`) em vez de duas.
create or replace function public.get_current_quests(p_user_id uuid)
returns table (
  user_quest_id uuid,
  quest_id text,
  title text,
  description text,
  icon text,
  period text,
  goal_type text,
  goal_value numeric,
  xp_reward integer,
  progress numeric,
  completed boolean,
  completed_at timestamptz
) as $$
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;

  perform public.ensure_quests_for_period(p_user_id);

  return query
    select uq.id, qt.id, qt.title, qt.description, qt.icon, qt.period, qt.goal_type, qt.goal_value, qt.xp_reward,
           uq.progress, uq.completed, uq.completed_at
      from public.user_quests uq
      join public.quest_templates qt on qt.id = uq.quest_id
      where uq.user_id = p_user_id
        and (
          (qt.period = 'daily' and uq.period_start = current_date) or
          (qt.period = 'weekly' and uq.period_start = date_trunc('week', now())::date)
        )
      -- Diários antes do semanal; dentro de cada grupo, os ainda não
      -- completos primeiro (é o que a pessoa quer ver de cara).
      order by (qt.period = 'weekly'), uq.completed, qt.title;
end;
$$ language plpgsql security definer;

-- 4. PROGRESSO — a cada atividade nova, avança todo desafio em aberto do
--    período em que a atividade caiu (dia/semana DELA, não "hoje" fixo —
--    importa pra não contar uma atividade atrasada registrada manualmente
--    num desafio de um dia diferente). Não precisa checar `auth.uid()` aqui
--    porque quem dispara isso é o INSERT em `activities`, que já só aceita
--    `user_id = auth.uid()` pela própria política daquela tabela.
create or replace function public.progress_quests()
returns trigger as $$
declare
  q record;
  activity_day date := new.date::date;
  activity_week date := date_trunc('week', new.date)::date;
  increment numeric;
  new_progress numeric;
begin
  for q in
    select uq.id as uq_id, uq.progress, qt.goal_type, qt.goal_value, qt.xp_reward
      from public.user_quests uq
      join public.quest_templates qt on qt.id = uq.quest_id
      where uq.user_id = new.user_id
        and uq.completed = false
        and (
          (qt.period = 'daily' and uq.period_start = activity_day) or
          (qt.period = 'weekly' and uq.period_start = activity_week)
        )
  loop
    increment := case q.goal_type
      when 'distance_km' then new.distance_km
      when 'duration_min' then new.duration_sec / 60.0
      when 'activity_count' then 1
      else 0
    end;
    new_progress := q.progress + increment;

    if new_progress >= q.goal_value then
      update public.user_quests
        set progress = q.goal_value, completed = true, completed_at = now()
        where id = q.uq_id;
      update public.profiles set xp = xp + q.xp_reward where id = new.user_id;
    else
      update public.user_quests set progress = new_progress where id = q.uq_id;
    end if;
  end loop;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_activity_progress_quests on public.activities;
create trigger on_activity_progress_quests
  after insert on public.activities
  for each row execute procedure public.progress_quests();

-- Sem política nova de RLS: `user_quests` já só deixa cada usuário LER os
-- próprios desafios ("Usuário só vê os próprios desafios", de
-- gamification_schema.sql); toda escrita acontece pelas funções acima, que
-- rodam `security definer` E conferem `auth.uid()` na entrada — ninguém lê,
-- cria ou grava progresso/XP de outra pessoa.
