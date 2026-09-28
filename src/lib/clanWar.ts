// Espelha, só pra UI, a mesma matemática de "que fim de semana é esse" que
// existe no banco (war_saturday_of / current_war_saturday em
// supabase/clan_war_schema.sql) — dá pra saber se a guerra está rolando
// agora e quando é a próxima sem esperar uma resposta do servidor. O placar
// em si (quem tem quanto XP) SEMPRE vem do banco (useClanWar) — nunca é
// calculado aqui, porque depende de atividades de várias pessoas.

/** Hoje é sábado ou domingo — os únicos dias que contam pra guerra. */
export function isWarDay(d: Date = new Date()): boolean {
  const day = d.getDay(); // 0=domingo..6=sábado
  return day === 0 || day === 6;
}

/** Sábado (meia-noite local) do fim de semana em que `d` cai — só faz
 *  sentido chamar com uma data que já é sábado ou domingo. */
export function warSaturdayOf(d: Date = new Date()): Date {
  const day = d.getDay();
  const daysSinceSaturday = (day + 1) % 7;
  const sat = new Date(d);
  sat.setHours(0, 0, 0, 0);
  sat.setDate(sat.getDate() - daysSinceSaturday);
  return sat;
}

/** Sábado que abre a PRÓXIMA guerra — se hoje já é sábado/domingo, essa é a
 *  guerra atual, não a próxima; nesse caso devolve o sábado seguinte. */
export function nextWarStart(d: Date = new Date()): Date {
  const day = d.getDay();
  if (isWarDay(d)) {
    const sat = warSaturdayOf(d);
    sat.setDate(sat.getDate() + 7);
    return sat;
  }
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + daysUntilSaturday);
  return next;
}

/** dd/mm, sem ano — o suficiente pra "começa sábado, 27/09". */
export function formatDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Teto de XP que um atleta contribui pra guerra por dia — espelha
 *  `war_xp_cap_per_day()` no banco, só pra exibir na explicação da tela. */
export const WAR_XP_CAP_PER_DAY = 150;
