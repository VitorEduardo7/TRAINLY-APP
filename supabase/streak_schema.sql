-- =========================================================
-- TRAINLY APP - Streak semanal (Fase 2 do roteiro de gamificação)
-- Rode DEPOIS de gamification_schema.sql — usa a tabela `user_streaks` que
-- ele já cria. Este arquivo só acrescenta a LÓGICA (função + gatilho); a
-- tabela em si não muda.
-- =========================================================

-- Garante uma linha de streak pra cada perfil que já existia antes desta
-- migração — assim o app nunca precisa tratar "essa pessoa ainda não tem
-- linha em user_streaks" como caso especial (mostra 0 direto).
insert into public.user_streaks (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- Regras da semana: segunda a domingo (é o que `date_trunc('week', ...)` do
-- Postgres já usa por padrão — segue o calendário ISO 8601). Uma atividade
-- em qualquer dia da semana conta como "ativo" aquela semana inteira; váras
-- atividades na mesma semana não aceleram a sequência (ela sobe 1 por
-- semana, não por atividade).
create or replace function public.evaluate_weekly_streak()
returns trigger as $$
declare
  activity_week date := date_trunc('week', new.date)::date;
  st public.user_streaks%rowtype;
  weeks_diff integer;
  missed integer;
begin
  select * into st from public.user_streaks where user_id = new.user_id for update;

  -- Não deveria acontecer depois do INSERT acima, mas cobre o caso de um
  -- perfil criado sem passar pela migração (ex: se algum dia isso virar
  -- parte do cadastro) — a própria função se "autocura".
  if not found then
    insert into public.user_streaks (user_id, current_streak, longest_streak, freezes_available, last_active_week)
      values (new.user_id, 1, 1, 2, activity_week)
      on conflict (user_id) do nothing;
    return new;
  end if;

  if st.last_active_week is null then
    update public.user_streaks
      set current_streak = 1, longest_streak = greatest(longest_streak, 1),
          last_active_week = activity_week, updated_at = now()
      where user_id = new.user_id;
    return new;
  end if;

  weeks_diff := (activity_week - st.last_active_week) / 7;

  if weeks_diff <= 0 then
    -- Mesma semana já contabilizada, ou atividade atrasada/antiga registrada
    -- manualmente (data no passado) — não mexe na sequência atual.
    return new;

  elsif weeks_diff = 1 then
    -- Semana seguinte, sem furo: sequência continua normalmente. A cada 4
    -- semanas seguidas SEM precisar de congelamento, devolve 1 congelamento
    -- (até o teto de 2) — só quem mantém constância de verdade acumula.
    update public.user_streaks
      set current_streak = st.current_streak + 1,
          longest_streak = greatest(st.longest_streak, st.current_streak + 1),
          freezes_available = least(2, st.freezes_available + case when (st.current_streak + 1) % 4 = 0 then 1 else 0 end),
          last_active_week = activity_week,
          updated_at = now()
      where user_id = new.user_id;

  else
    -- Uma ou mais semanas inteiras sem nenhuma atividade.
    missed := weeks_diff - 1;
    if st.freezes_available >= missed then
      -- Furo coberto por congelamento(s) acumulados — sequência sobrevive.
      update public.user_streaks
        set current_streak = st.current_streak + 1,
            longest_streak = greatest(st.longest_streak, st.current_streak + 1),
            freezes_available = st.freezes_available - missed,
            last_active_week = activity_week,
            updated_at = now()
        where user_id = new.user_id;
    else
      -- Sem congelamento suficiente: sequência quebra e recomeça em 1. Os
      -- congelamentos que a pessoa tinha não são gastos (não ajudaram, mas
      -- também não somem) — ficam guardados pra próxima sequência.
      update public.user_streaks
        set current_streak = 1,
            last_active_week = activity_week,
            updated_at = now()
        where user_id = new.user_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_activity_evaluate_streak on public.activities;
create trigger on_activity_evaluate_streak
  after insert on public.activities
  for each row execute procedure public.evaluate_weekly_streak();
