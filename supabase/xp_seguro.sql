-- =========================================================
-- TRAINLY - XP calculado pelo banco (OPCIONAL, recomendado)
--
-- Rode DEPOIS do site_integration.sql. É seguro rodar de novo.
--
-- O que muda:
--   * O XP de cada atividade passa a ser calculado AQUI no banco, com a mesma
--     fórmula do site e do app (distância x 10 + minutos, mínimo 5). O valor
--     que o site/app mandar em `xp_earned` é ignorado.
--   * Ninguém consegue mais alterar o próprio XP (nem a data da recompensa
--     diária) mandando um UPDATE direto pela API.
--
-- O que NÃO muda:
--   * Registrar atividade manualmente continua funcionando no site e no app.
--   * O XP mostrado na tela é o mesmo de antes (mesma fórmula).
--   * Conquistas, missões, streak e recompensa diária continuam somando XP
--     normalmente (são funções do próprio banco).
--
-- Para desfazer, rode o bloco "DESFAZER" no fim deste arquivo.
-- =========================================================

-- 1. XP da atividade sempre calculado pelo banco
create or replace function public.compute_activity_xp()
returns trigger as $$
begin
  new.xp_earned := greatest(5, round(coalesce(new.distance_km, 0) * 10 + coalesce(new.duration_sec, 0) / 60.0))::int;
  return new;
end;
$$ language plpgsql;

drop trigger if exists before_activity_compute_xp on public.activities;
create trigger before_activity_compute_xp
  before insert or update of distance_km, duration_sec, xp_earned on public.activities
  for each row execute procedure public.compute_activity_xp();

-- 2. Perfil: o usuário só edita os campos "dele" (nome, bio, fotos, meta,
--    personalização). XP e recompensa diária só mudam por funções do banco.
revoke update on public.profiles from anon, authenticated;
grant update (
  name, bio, location, avatar_url, cover_url,
  monthly_goal_km, monthly_goal_type, monthly_goal_value,
  equipped_frame_tier, equipped_map_tier
) on public.profiles to authenticated;

-- O perfil é criado pelo gatilho do cadastro (schema.sql); pela API só dá
-- pra inserir os campos básicos, nunca XP.
revoke insert on public.profiles from anon, authenticated;
grant insert (id, name, bio, location, avatar_url) on public.profiles to authenticated;


-- =========================================================
-- DESFAZER (só se precisar voltar como era antes):
--
-- drop trigger if exists before_activity_compute_xp on public.activities;
-- grant update on public.profiles to authenticated;
-- grant insert on public.profiles to authenticated;
-- =========================================================
