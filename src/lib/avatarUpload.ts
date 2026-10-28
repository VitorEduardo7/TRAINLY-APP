import { pickImage, uploadImage } from './photoUpload';

/**
 * Abre a galeria, deixa a pessoa recortar em quadrado e sobe a foto pro bucket
 * `avatars` do Supabase Storage, dentro de uma pasta com o próprio userId
 * (as políticas de acesso do bucket exigem isso — ver supabase/avatars_storage.sql).
 *
 * Devolve a URL pública nova, ou `null` se a pessoa cancelou a escolha.
 * Lança erro se a permissão for negada ou o upload falhar.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const image = await pickImage({ aspect: [1, 1] });
  if (!image) return null;
  // O nome do arquivo já muda a cada envio (carimbo de tempo), então o
  // celular nunca mostra a foto antiga guardada no cache de imagem.
  return uploadImage('avatars', userId, image, 'avatar');
}

/** Mesmo fluxo pra foto de capa do perfil (bucket `covers`, recorte 3:1). */
export async function pickAndUploadCover(userId: string): Promise<string | null> {
  const image = await pickImage({ aspect: [3, 1] });
  if (!image) return null;
  return uploadImage('covers', userId, image, 'cover');
}
