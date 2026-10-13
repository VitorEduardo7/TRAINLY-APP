import { SUPABASE_ANON_KEY, SUPABASE_CONFIGURED, SUPABASE_URL } from './supabaseConfig';

export type ConnectionProblem =
  /** O `.env` não existe ou está com os valores de exemplo. */
  | 'not-configured'
  /** O projeto do Supabase está pausado (plano grátis pausa depois de ~7 dias sem uso). */
  | 'paused'
  /** A internet funciona, mas o endereço do banco não responde (projeto apagado ou URL errada no `.env`). */
  | 'unreachable'
  /** O banco respondeu com erro do servidor (instabilidade do Supabase). */
  | 'server-error'
  /** Sem internet no celular (ou a rede bloqueia o acesso). */
  | 'offline'
  /** Agora está tudo respondendo — o erro foi passageiro. */
  | 'ok';

/** `fetch` que desiste depois de `ms` (o padrão do celular pode esperar mais de um minuto). */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Descobre POR QUE o app não conseguiu falar com o banco, em vez de dizer
 * sempre "confira sua internet":
 *
 * 1. Sem `.env` → nem tenta.
 * 2. Bate no endpoint de saúde do próprio projeto (`/auth/v1/health`). Se
 *    responder 540, o projeto está pausado (código próprio do Supabase pra
 *    isso); outro 5xx é instabilidade deles; qualquer outra resposta quer
 *    dizer que agora está funcionando.
 * 3. Se nem respondeu, testa o site do Supabase: se o site abre, a internet
 *    está ok e o problema é o endereço do projeto; se não abre, é a internet
 *    (ou a rede bloqueando).
 */
export async function diagnoseConnection(): Promise<ConnectionProblem> {
  if (!SUPABASE_CONFIGURED) return 'not-configured';
  try {
    const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_ANON_KEY } }, 8000);
    if (res.status === 540) return 'paused';
    if (res.status >= 500) return 'server-error';
    return 'ok';
  } catch {
    try {
      await fetchWithTimeout('https://supabase.com/', { method: 'HEAD' }, 6000);
      return 'unreachable';
    } catch {
      return 'offline';
    }
  }
}

/** Texto curto e em português pra cada caso, pronto pra um alerta. */
export function describeConnectionProblem(problem: ConnectionProblem): string {
  switch (problem) {
    case 'not-configured':
      return 'O app está sem os dados do banco de dados (falta o arquivo .env na pasta do projeto). Copie o .env.example para .env, preencha com a URL e a chave do Supabase e rode de novo com "npx expo start --tunnel -c".';
    case 'paused':
      return 'O banco de dados (Supabase) está pausado — o plano grátis pausa sozinho depois de uns dias sem uso. Entre em supabase.com, abra o projeto e clique em "Resume project". Em alguns minutos volta a funcionar.';
    case 'unreachable':
      return 'Sua internet está funcionando, mas o banco de dados não respondeu. Confira no supabase.com se o projeto está ativo (pode ter sido pausado) e se a URL no arquivo .env está certa.';
    case 'server-error':
      return 'O banco de dados (Supabase) está instável agora. Espere alguns minutos e tente de novo.';
    case 'offline':
      return 'Sem conexão com a internet. Confira o Wi-Fi ou os dados móveis do celular (algumas redes de escola/empresa bloqueiam o acesso — teste com o 4G).';
    case 'ok':
      return 'A conexão oscilou, mas agora o banco está respondendo. Tente de novo.';
  }
}
