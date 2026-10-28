import { Activity, ActivityType } from '../types/models';

/**
 * Contas dos gráficos de evolução: junta os treinos por mês (no fuso do
 * aparelho) e calcula km, quantidade, tempo e o ritmo médio de cada mês.
 */

export interface MonthBucket {
  /** "2026-10" */
  key: string;
  /** "out" */
  label: string;
  /** "outubro de 2026" */
  longLabel: string;
  km: number;
  count: number;
  seconds: number;
}

export function monthlyBuckets(activities: Activity[], months: number, type: ActivityType | null, now = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      longLabel: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      km: 0,
      count: 0,
      seconds: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const a of activities) {
    if (type && a.type !== type) continue;
    const d = new Date(a.date);
    const b = byKey.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    if (!b) continue;
    b.km += Number(a.distance_km) || 0;
    b.count += 1;
    b.seconds += a.duration_sec || 0;
  }
  return buckets;
}

/** Como medir o "ritmo" de cada esporte (do jeito que cada um costuma falar). */
export type PaceKind = 'min_per_km' | 'min_per_100m' | 'kmh';

export function paceKindFor(type: ActivityType): PaceKind {
  if (type === 'Ciclismo') return 'kmh';
  if (type === 'Natação') return 'min_per_100m';
  return 'min_per_km';
}

/** Ritmo médio do mês (tempo total ÷ distância total). `null` se o mês não tem treino. */
export function bucketPace(b: MonthBucket, kind: PaceKind): number | null {
  if (b.km <= 0 || b.seconds <= 0) return null;
  if (kind === 'kmh') return b.km / (b.seconds / 3600);
  if (kind === 'min_per_100m') return b.seconds / 60 / (b.km * 10);
  return b.seconds / 60 / b.km;
}

/** Mais alto no gráfico = melhor? Pra ritmo (min/km) é o contrário: menor é mais rápido. */
export function higherIsBetter(kind: PaceKind): boolean {
  return kind === 'kmh';
}

export function formatPace(value: number, kind: PaceKind): string {
  if (kind === 'kmh') return `${value.toFixed(1).replace('.', ',')} km/h`;
  const total = Math.round(value * 60);
  const text = `${Math.floor(total / 60)}'${String(total % 60).padStart(2, '0')}"`;
  return kind === 'min_per_100m' ? `${text}/100m` : `${text}/km`;
}

/** Só o número, curto, pro eixo do gráfico. */
export function formatPaceTick(value: number, kind: PaceKind): string {
  if (kind === 'kmh') return value.toFixed(0);
  const total = Math.round(value * 60);
  return `${Math.floor(total / 60)}'${String(total % 60).padStart(2, '0')}`;
}

export const PACE_TITLE: Record<PaceKind, string> = {
  min_per_km: 'Ritmo médio',
  min_per_100m: 'Ritmo médio (por 100 m)',
  kmh: 'Velocidade média',
};

/** Arredonda o topo do eixo pra um número "bonito" (10, 15, 20, 25, 30, 40, 50, 60, 80, 100...). */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (value <= m * exp) return m * exp;
  }
  return 10 * exp;
}

/** Esporte mais comum da pessoa (pra escolher o gráfico de ritmo quando o filtro é "Todos"). */
export function mostCommonType(activities: Activity[]): ActivityType | null {
  const counts = new Map<ActivityType, number>();
  for (const a of activities) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  let best: ActivityType | null = null;
  let max = 0;
  counts.forEach((c, t) => {
    if (c > max) {
      max = c;
      best = t;
    }
  });
  return best;
}

/** Número do eixo: inteiro quando dá ("75"), senão uma casa ("7,5"). */
export function formatAxisNumber(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}
