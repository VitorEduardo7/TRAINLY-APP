import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

/**
 * Fotos do app e do site ficam no mesmo Storage do Supabase, cada tipo num
 * "bucket" (pasta) próprio — os mesmos que o site usa (ver
 * supabase/site_integration.sql e avatars_storage.sql):
 *
 * - `avatars`         foto de perfil
 * - `covers`          capa do perfil
 * - `activity-photos` foto de um treino
 * - `post-photos`     foto de uma publicação
 *
 * Todo arquivo vai dentro de uma pasta com o id do usuário (`<user_id>/...`):
 * as regras do Storage só deixam cada pessoa gravar/apagar na própria pasta.
 */
export type PhotoBucket = 'avatars' | 'covers' | 'activity-photos' | 'post-photos';

/** Tamanho máximo aceito por bucket (o mesmo limite configurado no banco). */
const MAX_MB: Record<PhotoBucket, number> = {
  avatars: 5,
  covers: 8,
  'activity-photos': 5,
  'post-photos': 5,
};

export interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
  ext: string;
  width: number;
  height: number;
}

/**
 * Abre a galeria e devolve a foto escolhida (ou `null` se a pessoa cancelou).
 * `aspect` liga o recorte (ex: [1, 1] pro avatar, [3, 1] pra capa); sem ele a
 * foto vem inteira, como no site.
 */
export async function pickImage(options?: { aspect?: [number, number] }): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Sem permissão pra acessar suas fotos. Habilite o acesso nas configurações do celular.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!options?.aspect,
    aspect: options?.aspect,
    quality: 0.6,
    base64: true,
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset?.base64) return null;

  // Extensão a partir do que a galeria devolveu; na dúvida, jpg (o formato
  // que a própria galeria usa depois de recortar/comprimir).
  const raw = asset.fileName?.split('.').pop()?.toLowerCase() || asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
  const ext = raw === 'png' || raw === 'webp' ? raw : 'jpg';
  return {
    uri: asset.uri,
    base64: asset.base64,
    ext,
    mimeType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
    width: asset.width,
    height: asset.height,
  };
}

/** Sobe a foto pro bucket, na pasta do usuário, e devolve a URL pública. */
export async function uploadImage(bucket: PhotoBucket, userId: string, image: PickedImage, prefix: string): Promise<string> {
  const bytes = decode(image.base64);
  if (bytes.byteLength > MAX_MB[bucket] * 1024 * 1024) {
    throw new Error(`Imagem muito grande (máx. ${MAX_MB[bucket]} MB). Escolha outra ou recorte antes.`);
  }
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${prefix}-${Date.now()}-${random}.${image.ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: image.mimeType,
    upsert: true,
  });
  if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Apaga um arquivo antigo a partir da URL pública (ao trocar a capa, apagar
 * uma publicação...). Falhar aqui não atrapalha nada — no pior caso o
 * arquivo só fica sobrando no Storage.
 */
export async function removeImageByUrl(bucket: PhotoBucket, url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return;
  const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // ignora: ver comentário acima
  }
}
