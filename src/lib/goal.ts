import { Activity, GoalType, Profile } from '../types/models';

/**
 * Meta do mês — igual ao site, pode ser em km, em número de atividades ou em
 * horas de treino. No banco: `monthly_goal_type` + `monthly_goal_value`
 * (site_integration.sql). O antigo `monthly_goal_km` continua existindo e um
 * gatilho do banco mantém os dois em sincronia quando a meta é em km.
 */
export const GOAL_TYPE_LABEL: Record<GoalType, string> = { km: 'km', activities: 'atividades', hours: 'horas' };

export function goalTypeOf(profile: Profile | null | undefined): GoalType {
  const t = profile?.monthly_goal_type;
  return t === 'activities' || t === 'hours' ? t : 'km';
}

export function goalValueOf(profile: Profile | null | undefined): number {
  const v = Number(profile?.monthly_goal_value);
  if (v > 0) return v;
  return Number(profile?.monthly_goal_km) || 50;
}

export interface GoalProgress {
  type: GoalType;
  current: number;
  target: number;
  pct: number;
  unit: string;
}

/** Quanto da meta já foi feito no mês atual. */
export function monthlyGoalProgress(profile: Profile | null | undefined, activities: Activity[], now = new Date()): GoalProgress {
  const type = goalTypeOf(profile);
  const target = goalValueOf(profile);
  const month = activities.filter((a) => {
    const d = new Date(a.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const current =
    type === 'activities'
      ? month.length
      : type === 'hours'
        ? month.reduce((s, a) => s + (a.duration_sec || 0), 0) / 3600
        : month.reduce((s, a) => s + Number(a.distance_km), 0);
  return { type, current, target, pct: target > 0 ? Math.min(1, current / target) : 0, unit: GOAL_TYPE_LABEL[type] };
}

/** "12,5" / "3" — número curto pra meta (inteiro quando dá). */
export function formatGoalNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace('.', ',');
}
