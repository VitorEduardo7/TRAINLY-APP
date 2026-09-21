import { Activity } from '../types/models';

export interface ActivitySummary {
  totalKm: number;
  totalSec: number;
  totalElev: number;
  activeDays: number;
  count: number;
  bestDistanceKm: number;
  longestDurationSec: number;
}

/**
 * Resumo e recordes a partir de uma lista de atividades. Compartilhado entre
 * o próprio perfil e o perfil público de outro atleta, pra os dois mostrarem
 * exatamente os mesmos números calculados do mesmo jeito.
 */
export function activityStats(activities: Activity[]): ActivitySummary {
  return {
    totalKm: activities.reduce((s, a) => s + Number(a.distance_km), 0),
    totalSec: activities.reduce((s, a) => s + a.duration_sec, 0),
    totalElev: activities.reduce((s, a) => s + (a.elevation_m || 0), 0),
    activeDays: new Set(activities.map((a) => new Date(a.date).toDateString())).size,
    count: activities.length,
    bestDistanceKm: activities.reduce((max, a) => Math.max(max, Number(a.distance_km)), 0),
    longestDurationSec: activities.reduce((max, a) => Math.max(max, a.duration_sec), 0),
  };
}
