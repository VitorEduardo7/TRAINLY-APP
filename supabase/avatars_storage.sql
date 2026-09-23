-- Bucket de fotos de perfil + regras de acesso.
--
-- Rode isso UMA VEZ no SQL Editor do seu projeto Supabase (dashboard →
-- SQL Editor → New query → cola isso → Run). Sem isso, o botão de trocar
-- foto no app dá erro "bucket not found" ao tentar subir a imagem.
--
-- Cada foto é salva no caminho "<user_id>/avatar-....jpg" — as políticas
-- abaixo usam esse primeiro pedaço do caminho pra garantir que cada pessoa
-- só consegue enviar/trocar/apagar a PRÓPRIA foto. Leitura é pública (senão
-- ninguém além do dono conseguiria ver a foto de perfil de outra pessoa no
-- feed, nos comentários, etc).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
