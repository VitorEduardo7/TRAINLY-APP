export interface StreakRow {
  current_streak: number;
  longest_streak: number;
  freezes_available: number;
  /** Segunda-feira (AAAA-MM-DD) da última semana com atividade válida, ou `null` se nunca teve. */
  last_active_week: string | null;
}

export type StreakStatus =
  | 'none' // nunca registrou atividade — não tem streak pra mostrar
  | 'active_this_week' // já correu essa semana, sequência garantida
  | 'needs_activity' // correu semana passada; precisa correr essa semana pra não quebrar
  | 'protected' // já ficou 1+ semana sem correr, mas tem congelamento suficiente pra segurar
  | 'expired'; // ficou sem correr além do que os congelamentos cobrem — a sequência já era

export interface EffectiveStreak {
  status: StreakStatus;
  /** O que mostrar como número do foguinho agora. */
  count: number;
}

/** Segunda-feira (00:00, hora local) da semana de uma data. Exportada — além
 *  de uso interno aqui, a tela de Sequência usa pra montar o calendário
 *  segunda-a-domingo da semana atual. */
export function mondayOf(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = domingo .. 6 = sábado
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function weeksBetween(later: Date, earlier: Date): number {
  return Math.round((mondayOf(later).getTime() - mondayOf(earlier).getTime()) / MS_PER_WEEK);
}

/**
 * Sequência "de verdade" agora, calculada no aparelho — o banco só atualiza
 * `user_streaks` quando uma atividade NOVA é registrada (ver o gatilho
 * `evaluate_weekly_streak` em supabase/streak_schema.sql), então uma pessoa
 * inativa há semanas continuaria com o número antigo se a tela só lesse a
 * coluna direto. Esta função repete a MESMA regra do gatilho, só que sem
 * escrever nada, pra decidir o que mostrar sem esperar a próxima corrida
 * "confirmar" que a sequência quebrou.
 *
 * (Só uma diferença honesta: a semana aqui é calculada no fuso do aparelho,
 * e no banco é no fuso da sessão do Postgres — pode discordar por até
 * algumas horas bem no limite entre domingo e segunda. Sem impacto real:
 * é só pra decidir COMO mostrar o número, nunca escreve no banco.)
 */
export function effectiveStreak(streak: StreakRow | null | undefined, now: Date = new Date()): EffectiveStreak {
  if (!streak || !streak.last_active_week || streak.current_streak <= 0) {
    return { status: 'none', count: 0 };
  }

  const lastActive = new Date(`${streak.last_active_week}T00:00:00`);
  const weeksDiff = weeksBetween(now, lastActive);

  if (weeksDiff <= 0) return { status: 'active_this_week', count: streak.current_streak };
  if (weeksDiff === 1) return { status: 'needs_activity', count: streak.current_streak };

  const missed = weeksDiff - 1;
  if (streak.freezes_available >= missed) {
    return { status: 'protected', count: streak.current_streak };
  }
  return { status: 'expired', count: 0 };
}
