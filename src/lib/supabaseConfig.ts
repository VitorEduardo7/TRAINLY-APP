// Os dados do projeto Supabase vêm do arquivo `.env` na raiz (ver README,
// Passo 1). Ficam num arquivo próprio, separado do cliente, pra que a tela de
// login consiga avisar com clareza quando eles estão faltando.
const PLACEHOLDER_URL = 'https://SEU-PROJETO.supabase.co';
const PLACEHOLDER_KEY = 'SUA-CHAVE-ANON-AQUI';

export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? PLACEHOLDER_URL).trim().replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? PLACEHOLDER_KEY).trim();

/**
 * false quando o `.env` não existe (ou ainda está com os valores de exemplo).
 * Acontece sempre que o projeto é baixado do GitHub num PC novo: o `.env` não
 * vai pro GitHub de propósito (tem a chave do banco), então precisa ser
 * criado de novo em cada computador.
 */
export const SUPABASE_CONFIGURED =
  /^https:\/\/.+/.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes('SEU-PROJETO') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('SUA-CHAVE');
