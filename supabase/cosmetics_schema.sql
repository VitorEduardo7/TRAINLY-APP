-- =========================================================
-- TRAINLY APP - Personalização por patente (moldura de avatar + cor do mapa)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase, depois de
-- já ter rodado schema.sql. Não depende de gamification_schema.sql nem de
-- avatars_storage.sql — só adiciona duas colunas na tabela que já existe.
-- =========================================================

-- Qual moldura/cor de mapa a pessoa prefere USAR — pode ser diferente da
-- patente atual dela (ex: já é Diamante mas prefere a moldura Ouro). `null`
-- em qualquer uma das duas significa "automático": usa a patente atual.
-- O app só deixa escolher uma patente já desbloqueada (nível suficiente),
-- e `effectiveTier()` (src/lib/rank.ts) confere isso de novo na leitura —
-- por isso não precisa de validação aqui no banco.
alter table public.profiles
  add column if not exists equipped_frame_tier text
    check (equipped_frame_tier is null or equipped_frame_tier in ('Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante'));

alter table public.profiles
  add column if not exists equipped_map_tier text
    check (equipped_map_tier is null or equipped_map_tier in ('Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante'));

-- Sem política nova: a leitura já é pública pra usuário logado
-- ("Perfis são visíveis para qualquer usuário logado") e a escrita já é
-- restrita ao dono do perfil ("Usuário só edita o próprio perfil"), então as
-- duas colunas novas herdam as mesmas regras automaticamente.
