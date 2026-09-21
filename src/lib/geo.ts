// ---------------------------------------------------------------------------
// Núcleo de geolocalização do Trainly.
//
// A distância usa a mesma fórmula de Haversine do site (mapa.php / js/main.js).
// O resto é específico do app e existe pra deixar o rastreio por GPS mais
// confiável do que "somar a distância entre todo ponto recebido":
//
//  - isAccuratePoint / MAX_ACCURACY_M   -> descarta leituras de GPS imprecisas
//  - decidePoint                        -> rejeita "saltos" (velocidade
//                                           implausível) e absorve o tremor
//                                           do sinal quando parado, usando
//                                           uma "âncora" que só avança
//                                           quando há movimento real
//  - currentPaceMinPerKm                -> ritmo atual (janela deslizante),
//                                           separado do ritmo médio da prova
//  - splits (KmSplit)                   -> tempo de cada km percorrido
//  - elevação                           -> ganho de altitude, ignorando
//                                           ruído pequeno do sensor
// ---------------------------------------------------------------------------

export type TrainlyActivityKind = 'Corrida' | 'Caminhada' | 'Ciclismo';

export const TRACKABLE_ACTIVITY_KINDS: TrainlyActivityKind[] = ['Corrida', 'Caminhada', 'Ciclismo'];

export interface TrackPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  /** precisão horizontal informada pelo próprio GPS, em metros de raio */
  accuracy: number | null;
  /** velocidade instantânea informada pelo próprio GPS, m/s (null se o aparelho não informar) */
  speed: number | null;
  /** ms desde epoch */
  timestamp: number;
}

// --- Distância (Haversine) --------------------------------------------------

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// --- Filtros de ruído de GPS -------------------------------------------------

// Acima disso (metros de raio de incerteza que o próprio GPS reporta), a
// leitura é descartada em vez de "puxar" a rota pro lugar errado.
export const MAX_ACCURACY_M = 25;

// Deslocamento entre a âncora de distância e o novo ponto menor que isso é
// tratado como tremor do sinal (usuário parado), não como distância percorrida.
// Era 3 m; numa corrida (~3 m/s) o app atualiza a cada ~1s (watchPositionAsync
// com timeInterval: 1000), então o deslocamento real de UM tick já fica bem
// perto de 3 m — qualquer ruído de sinal fazia vários ticks seguidos ficarem
// abaixo do limite (distância "empacada"), o que também distorcia o ritmo
// atual (ver currentPaceMinPerKm). 2 m ainda filtra bem o tremor parado (GPS
// parado costuma oscilar ~1 m com boa precisão) sem descartar tanto movimento
// real de quem tá correndo.
export const MIN_SEGMENT_KM = 0.002; // 2 m

// Ganho de altitude menor que isso é ruído do sensor, não subida real.
export const MIN_ELEVATION_DELTA_M = 1.5;

// Segundos sem nenhum movimento real (com o app em modo "correndo") até
// pausar automaticamente — evita que o cronômetro continue correndo com o
// usuário parado num semáforo, bebendo água etc. Era 25s, o que deixava
// parada rápida (ex: atravessar uma rua) inteira contando como "correndo" no
// ritmo médio; a maioria dos apps de corrida usa algo entre 8-15s.
export const AUTO_PAUSE_AFTER_SEC = 12;

// Velocidade acima da qual um "salto" de GPS é fisicamente improvável pra
// cada tipo de atividade — usado pra rejeitar pontos que teleportam por
// reflexo de sinal (prédios, túneis etc.).
const SPEED_CEILING_KMH: Record<TrainlyActivityKind, number> = {
  Corrida: 30,
  Caminhada: 12,
  Ciclismo: 70,
};

export function isAccuratePoint(accuracyM: number | null): boolean {
  return accuracyM == null || accuracyM <= MAX_ACCURACY_M;
}

export interface PointDecision {
  /** true = ponto confiável; pode desenhar no mapa e mover o marcador */
  accept: boolean;
  /** true = esse ponto vira a nova referência ("âncora") pra medir distância */
  advanceAnchor: boolean;
  addDistanceKm: number;
  addElevationM: number;
  reason: 'ok' | 'low_accuracy' | 'gps_jump' | 'stationary' | 'duplicate' | 'first_point';
}

const NO_DECISION: Omit<PointDecision, 'reason'> = {
  accept: false,
  advanceAnchor: false,
  addDistanceKm: 0,
  addElevationM: 0,
};

/**
 * Decide o que fazer com uma nova leitura de GPS.
 *
 * `lastRaw` é o último ponto bruto recebido (usado só pra detectar saltos
 * impossíveis, comparando o tempo decorrido com a distância implicada).
 *
 * `anchor` é a última referência usada pra somar distância — ela só avança
 * quando há movimento real (>= MIN_SEGMENT_KM), então o tremor do GPS parado
 * (que fica oscilando em várias direções ao redor do mesmo ponto) não vai
 * somando distância aos poucos.
 */
export function decidePoint(
  point: TrackPoint,
  lastRaw: TrackPoint | null,
  anchor: TrackPoint | null,
  activityKind: TrainlyActivityKind,
): PointDecision {
  if (!isAccuratePoint(point.accuracy)) {
    return { ...NO_DECISION, reason: 'low_accuracy' };
  }

  if (lastRaw) {
    const elapsedSec = (point.timestamp - lastRaw.timestamp) / 1000;
    if (elapsedSec <= 0) {
      return { ...NO_DECISION, reason: 'duplicate' };
    }
    const jumpKm = haversineKm(lastRaw.latitude, lastRaw.longitude, point.latitude, point.longitude);
    const impliedSpeedKmh = (jumpKm / elapsedSec) * 3600;
    if (impliedSpeedKmh > SPEED_CEILING_KMH[activityKind]) {
      return { ...NO_DECISION, reason: 'gps_jump' };
    }
  }

  if (!anchor) {
    return { accept: true, advanceAnchor: true, addDistanceKm: 0, addElevationM: 0, reason: 'first_point' };
  }

  const distFromAnchorKm = haversineKm(anchor.latitude, anchor.longitude, point.latitude, point.longitude);
  if (distFromAnchorKm < MIN_SEGMENT_KM) {
    return { accept: true, advanceAnchor: false, addDistanceKm: 0, addElevationM: 0, reason: 'stationary' };
  }

  let addElevationM = 0;
  if (anchor.altitude != null && point.altitude != null) {
    const delta = point.altitude - anchor.altitude;
    if (delta > MIN_ELEVATION_DELTA_M) addElevationM = delta;
  }

  return { accept: true, advanceAnchor: true, addDistanceKm: distFromAnchorKm, addElevationM, reason: 'ok' };
}

// --- Qualidade do sinal (feedback visual pro usuário) ------------------------

export type GpsQuality = 'searching' | 'good' | 'ok' | 'bad';

export function describeAccuracy(accuracyM: number | null): { label: string; quality: GpsQuality } {
  if (accuracyM == null) return { label: 'GPS ativo — procurando sinal preciso…', quality: 'ok' };
  if (accuracyM <= 10) return { label: `Sinal de GPS excelente (±${Math.round(accuracyM)} m)`, quality: 'good' };
  if (accuracyM <= MAX_ACCURACY_M) return { label: `Sinal de GPS bom (±${Math.round(accuracyM)} m)`, quality: 'ok' };
  return { label: `Sinal fraco (±${Math.round(accuracyM)} m) — pontos ignorados até melhorar`, quality: 'bad' };
}

// --- Formatação ---------------------------------------------------------------

export function formatKm(km: number): string {
  return km.toFixed(2).replace('.', ',');
}

/**
 * Distância curta, pra caber em espaço apertado (rótulo em cima das barras do
 * gráfico semanal, onde cada coluna tem ~45px). "2151,27" estourava a coluna e
 * encostava na vizinha; aqui vira "2,2k".
 */
export function formatKmShort(km: number): string {
  if (km >= 1000) return `${(km / 1000).toFixed(1).replace('.', ',')}k`;
  if (km >= 100) return String(Math.round(km));
  if (km >= 10) return km.toFixed(1).replace('.', ',');
  return km.toFixed(1).replace('.', ',');
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function paceMinPerKm(distanceKm: number, seconds: number): string {
  if (distanceKm <= 0 || seconds <= 0) return "--'--\"";
  const paceSecPerKm = seconds / distanceKm;
  const min = Math.floor(paceSecPerKm / 60);
  const sec = Math.round(paceSecPerKm % 60);
  return `${min}'${String(sec).padStart(2, '0')}"`;
}

export function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}

// --- Ritmo atual: janela deslizante, diferente do ritmo médio da prova ------

export interface PaceSample {
  timestamp: number; // ms
  cumulativeKm: number;
}

const CURRENT_PACE_WINDOW_SEC = 30;
// quanto de histórico manter (folga sobre a janela, pra não recalcular do zero)
export const PACE_HISTORY_MAX_AGE_SEC = 120;

export function currentPaceMinPerKm(history: PaceSample[]): string {
  if (history.length < 2) return "--'--\"";
  const latest = history[history.length - 1];
  const cutoff = latest.timestamp - CURRENT_PACE_WINDOW_SEC * 1000;

  let windowStart = history[0];
  for (const sample of history) {
    if (sample.timestamp >= cutoff) {
      windowStart = sample;
      break;
    }
  }

  const distanceKm = latest.cumulativeKm - windowStart.cumulativeKm;
  const seconds = (latest.timestamp - windowStart.timestamp) / 1000;
  if (seconds < 5) return "--'--\"";
  return paceMinPerKm(distanceKm, seconds);
}

// --- Ritmo atual: fonte preferida (velocidade instantânea do GPS) -----------
//
// O chip de GPS calcula velocidade por efeito Doppler a cada leitura — é bem
// mais estável do que derivar ritmo de "distância percorrida / tempo" numa
// janela curta, porque não depende de dois pontos de posição (cada um com seu
// próprio ruído) subtraídos entre si. currentPaceMinPerKm (acima) também só
// ganha uma amostra nova quando a âncora de distância avança; num trecho onde
// isso fica "empacado" por alguns segundos (ver MIN_SEGMENT_KM), o ritmo
// atual não atualizava nesse meio tempo e então pulava de uma vez quando a
// âncora finalmente avançava — é o que dava a sensação de ritmo "simulado".
// Usando a velocidade do GPS, o ritmo atual atualiza a cada leitura aceita,
// não só quando a distância avança.
export function paceFromSpeedMps(
  speedMps: number | null | undefined,
  activityKind: TrainlyActivityKind,
): string | null {
  if (speedMps == null || speedMps < 0) return null;
  const speedKmh = speedMps * 3.6;
  if (speedKmh <= 0.5) return null; // essencialmente parado — quem chama decide o que mostrar
  if (speedKmh > SPEED_CEILING_KMH[activityKind]) return null; // leitura implausível, ignora
  return paceMinPerKm(1, 3600 / speedKmh);
}

// --- Splits por km -------------------------------------------------------------

export interface KmSplit {
  km: number;
  seconds: number;
}

export function formatSplitPace(split: KmSplit): string {
  return paceMinPerKm(1, split.seconds);
}

// --- Rótulos por tipo de atividade ---------------------------------------------

export function startButtonLabel(kind: TrainlyActivityKind): string {
  switch (kind) {
    case 'Caminhada':
      return 'Iniciar caminhada';
    case 'Ciclismo':
      return 'Iniciar pedalada';
    default:
      return 'Iniciar corrida';
  }
}
