// Réplica exata da lógica de patentes/XP do site (js/main.js)
import { RANKS } from '../theme/colors';

export interface RankInfo {
  level: number;
  xpIntoLevel: number;
  xpToNext: number;
  progressPct: number;
  rank: { name: string; min: number; color: string };
}

export function getRankForLevel(level: number) {
  let current: (typeof RANKS)[number] = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.min) current = r;
  }
  return current;
}

export function levelInfo(totalXp: number): RankInfo {
  let level = 1;
  let xpToNext = 100;
  let remaining = totalXp;
  while (remaining >= xpToNext) {
    remaining -= xpToNext;
    level++;
    xpToNext = level * 100;
  }
  return {
    level,
    xpIntoLevel: remaining,
    xpToNext,
    progressPct: Math.max(4, Math.round((remaining / xpToNext) * 100)),
    rank: getRankForLevel(level),
  };
}

export function xpFromActivity(distanceKm: number, durationSec: number): number {
  const base = distanceKm * 10;
  const timeBonus = durationSec / 60;
  return Math.max(5, Math.round(base + timeBonus));
}

// --- Trilha de patentes (Bronze -> Diamante) --------------------------------

/**
 * XP acumulado necessário pra CHEGAR num nível.
 *
 * `levelInfo` sobe de nível quando o XP restante alcança `nível * 100` — ou
 * seja, ir do nível L pro L+1 custa L*100. Somando de 1 até n-1:
 * 100 * (n-1)n/2 = 50n(n-1). Serve pra dizer quanto XP ainda falta pra
 * próxima patente sem precisar simular o loop de níveis.
 */
export function totalXpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export interface RankStep {
  name: string;
  /** Nível mínimo pra desbloquear essa patente. */
  min: number;
  color: string;
  emblem: string;
  /** Já alcançada (inclui a atual). */
  achieved: boolean;
  /** É exatamente a patente em que o atleta está agora. */
  isCurrent: boolean;
  /** Quantos níveis faltam pra desbloquear (0 se já alcançada). */
  levelsAway: number;
  /** Quanto XP ainda falta pra desbloquear (0 se já alcançada). */
  xpAway: number;
}

const EMBLEMS: Record<string, string> = {
  Bronze: '🥉',
  Prata: '🥈',
  Ouro: '🥇',
  Platina: '💠',
  Diamante: '💎',
};

/**
 * A trilha inteira de patentes com o estado de cada uma pra um dado XP:
 * as que o atleta já conquistou, a atual, e as que ainda pode evoluir.
 */
export function rankTrail(totalXp: number): RankStep[] {
  const { level } = levelInfo(totalXp);
  const current = getRankForLevel(level);
  return RANKS.map((r) => {
    const achieved = level >= r.min;
    return {
      name: r.name,
      min: r.min,
      color: r.color,
      emblem: EMBLEMS[r.name] ?? '🏅',
      achieved,
      isCurrent: r.name === current.name,
      levelsAway: achieved ? 0 : r.min - level,
      xpAway: achieved ? 0 : Math.max(0, totalXpForLevel(r.min) - totalXp),
    };
  });
}

/** Próxima patente ainda não conquistada (null se já está no topo). */
export function nextRankStep(totalXp: number): RankStep | null {
  return rankTrail(totalXp).find((r) => !r.achieved) ?? null;
}
