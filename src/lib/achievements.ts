import { AchievementCategory, AchievementDefinition, AchievementTier } from '../types/models';
import { ColorBlindMode, tierColor } from '../theme/colors';

/** Ordem e nome de cada grupo na tela de conquistas. */
export const CATEGORY_ORDER: AchievementCategory[] = [
  'milestone',
  'distance',
  'single',
  'speed',
  'sports',
  'time_of_day',
  'consistency',
  'social',
  'clubs',
  'quests',
  'secret',
];

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  milestone: 'Marcos',
  distance: 'Distância acumulada',
  single: 'Num treino só',
  speed: 'Ritmo e velocidade',
  sports: 'Esportes',
  time_of_day: 'Horário',
  consistency: 'Constância',
  social: 'Social',
  clubs: 'Clubes e rotas',
  quests: 'Desafios',
  secret: 'Secretas',
};

export const TIER_LABEL: Record<AchievementTier, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  lendaria: 'Lendária',
};

/** Cor do nível — as mesmas das patentes (e respeita o modo daltônico). */
export function achievementTierColor(tier: AchievementTier | undefined, mode?: ColorBlindMode): string {
  switch (tier) {
    case 'prata':
      return tierColor('Prata', mode);
    case 'ouro':
      return tierColor('Ouro', mode);
    case 'lendaria':
      return tierColor('Diamante', mode);
    default:
      return tierColor('Bronze', mode);
  }
}

/** Meta lida das regras (`gte` ou `lte`). */
export function achievementTarget(def: AchievementDefinition): number {
  const p = def.params ?? {};
  return Number(p.gte ?? p.lte ?? 1) || 1;
}

/** "Quanto menor melhor" (ritmo). */
export function isLowerBetter(def: AchievementDefinition): boolean {
  return def.params != null && 'lte' in def.params;
}

function paceText(minPerKm: number): string {
  const total = Math.round(minPerKm * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}/km`;
}

function shortNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('pt-BR');
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

/**
 * Texto do progresso de uma conquista trancada: "7 de 10", "84 de 100 km",
 * "Seu melhor: 5:12/km". `null` quando não faz sentido mostrar (regras de sim/não).
 */
export function progressText(def: AchievementDefinition, current: number | null): string | null {
  const stat = String(def.params?.stat ?? '');
  const target = achievementTarget(def);
  if (isLowerBetter(def)) {
    if (current == null) return null;
    return stat.startsWith('best_pace') ? `Seu melhor: ${paceText(current)}` : `Seu melhor: ${shortNumber(current)}`;
  }
  if (target <= 1 || current == null) return null;
  const value = Math.min(current, target);
  if (stat === 'best_bike_kmh') return `Seu melhor: ${shortNumber(Math.round(current * 10) / 10)} km/h`;
  const unit = stat.endsWith('_km') || stat === 'max_km' ? ' km' : stat === 'max_minutes' ? ' min' : stat === 'max_elevation' ? ' m' : '';
  return `${shortNumber(Math.floor(value * 10) / 10)} de ${shortNumber(target)}${unit}`;
}

/** 0..1 pra barra de progresso (só regras "chegue em X"). */
export function progressRatio(def: AchievementDefinition, current: number | null): number | null {
  if (isLowerBetter(def) || current == null) return null;
  const target = achievementTarget(def);
  if (target <= 1) return null;
  return Math.max(0, Math.min(1, current / target));
}
