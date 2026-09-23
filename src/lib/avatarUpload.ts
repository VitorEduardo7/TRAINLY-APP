import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

/**
 * Abre a galeria, deixa a pessoa recortar em quadrado e sobe a foto pro bucket
 * `avatars` do Supabase Storage, dentro de uma pasta com o próprio userId
 * (as políticas de acesso do bucket exigem isso — ver supabase/avatars_storage.sql).
 *
 * Devolve a URL pública nova, ou `null` se a pessoa cancelou a escolha.
 * Lança erro se a permissão for negada ou o upload falhar.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Sem permissão pra acessar suas fotos. Habilite o acesso nas configurações do celular.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset?.base64) return null;
  const base64 = asset.base64;

  // Extensão a partir do que a galeria devolveu — na dúvida cai pra jpg, que
  // é o formato mais comum depois do recorte do próprio picker.
  const ext = asset.fileName?.split('.').pop()?.toLowerCase() || asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), {
      contentType: asset.mimeType ?? `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Sem isso, o app (e o de qualquer amigo que já tinha essa tela aberta)
  // continuava mostrando a foto antiga por causa do cache de imagem do
  // celular — a URL do arquivo é sempre a mesma pro mesmo usuário se o nome
  // não mudar, então adiciona um carimbo de tempo só pra invalidar esse cache.
  return `${data.publicUrl}?t=${Date.now()}`;
}
