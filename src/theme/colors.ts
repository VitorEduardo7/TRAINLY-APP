// Paleta do Trainly — identidade "Noturno" (out/2026).
//
// O azul da marca (#2f7dfd escuro / #267cee claro) continua o MESMO do site
// (css/global.css), pra app e site seguirem parecendo o mesmo produto. Em volta
// dele: fundo "noite violeta" (treino noturno, estádio aceso), superfícies em
// tons de violeta e um dourado próprio pro XP — a medalha, sempre na mesma cor.
// A paleta veio do redesign "Arena" (aprovada pelo usuário); o que mudou no
// "Noturno" foi a forma: linhas finas no lugar do degrau 3D de jogo infantil.
//
// Mantém os mesmos tokens para dark e light, então qualquer tela que use
// `theme.colors.x` funciona nos dois modos automaticamente.

export type ThemeMode = 'dark' | 'light';

export interface TrainlyColors {
  primary: string;
  primaryHover: string;
  /** Azul mais fundo (sombra do botão principal, trilho ativo). */
  primaryLedge: string;
  background: string;
  card: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  /** Um tom mais escuro que o fundo (sombras rasas, contorno de destaque no alto contraste). */
  ledge: string;
  avatarBg: string;
  danger: string;
  success: string;
  white: string;
  /** Superfície um degrau acima do card (chips, campos dentro de um card, trilho de barra). */
  surface: string;
  /** Primária translúcida — fundo de ícones e destaques suaves. */
  primarySoft: string;
  /** Gradiente da marca (botão principal, barras de progresso, destaques). */
  gradient: readonly [string, string];
  warning: string;
  /** Cor da sombra dos cards (só aparece de verdade no tema claro). */
  shadow: string;
  /** "Segundo tom" de destaque — o próprio azul da marca (pedido do usuário). */
  accent: string;
  accentSoft: string;
  accentGradient: readonly [string, string];
  /** Dourado do XP: barra de nível, recompensas, "+80 XP". Preenchimento. */
  gold: string;
  goldLedge: string;
  goldSoft: string;
  /** Dourado legível como TEXTO sobre o fundo do tema (no claro é mais escuro). */
  goldText: string;
  /** Texto/ícone em cima de um preenchimento dourado. */
  onGold: string;
  /** Gradiente da barra de XP. */
  goldGradient: readonly [string, string];
}

/**
 * Par de cores por aba. Antes alimentava os "blobs" de gradiente atrás do
 * cabeçalho; no redesign Arena o cabeçalho ficou liso, e isso só sobra como
 * cor de ícone de destaque (ex: bandeira da Guerra de Clã). Todas no azul da
 * marca, a pedido do usuário.
 */
export const SCREEN_WASH = {
  dashboard: ['#2f7dfd', '#1f5ee8'],
  friends: ['#2f7dfd', '#1f5ee8'],
  clubs: ['#2f7dfd', '#1f5ee8'],
  explore: ['#2f7dfd', '#1f5ee8'],
  history: ['#2f7dfd', '#1f5ee8'],
  profile: ['#2f7dfd', '#1f5ee8'],
  clanWar: ['#2f7dfd', '#1f5ee8'],
} as const satisfies Record<string, readonly [string, string]>;

export type ScreenWashKey = keyof typeof SCREEN_WASH;

export const darkColors: TrainlyColors = {
  primary: '#2f7dfd',
  primaryHover: '#5c9aff',
  primaryLedge: '#1a4fb8',
  background: '#140f2a',
  card: '#211a3e',
  textPrimary: '#f4f1ff',
  textMuted: '#a49cc4',
  border: '#322a5c',
  ledge: '#0b0820',
  avatarBg: '#2b5d34',
  danger: '#f2475c',
  success: '#2ebd6b',
  white: '#ffffff',
  surface: '#2b2352',
  primarySoft: 'rgba(47,125,253,0.18)',
  gradient: ['#4a93ff', '#1f5ee8'],
  warning: '#ff9f1c',
  shadow: '#000000',
  accent: '#2f7dfd',
  accentSoft: 'rgba(47,125,253,0.18)',
  accentGradient: ['#4a93ff', '#1f5ee8'],
  gold: '#ffc93c',
  goldLedge: '#c98a0b',
  goldSoft: 'rgba(255,201,60,0.15)',
  goldText: '#ffc93c',
  onGold: '#2a1b00',
  goldGradient: ['#ffd966', '#f5a623'],
};

export const lightColors: TrainlyColors = {
  primary: '#267cee',
  primaryHover: '#1a63c6',
  primaryLedge: '#1a57b0',
  background: '#f3f1fb',
  card: '#ffffff',
  textPrimary: '#1c1638',
  textMuted: '#6b6491',
  border: '#e2ddf3',
  ledge: '#d9d3ee',
  avatarBg: '#2b5d34',
  danger: '#dc2f45',
  success: '#16a058',
  white: '#ffffff',
  surface: '#edeaf8',
  primarySoft: 'rgba(38,124,238,0.12)',
  gradient: ['#3a8bff', '#1a5fd0'],
  warning: '#d97706',
  shadow: '#2a1f5c',
  accent: '#267cee',
  accentSoft: 'rgba(38,124,238,0.12)',
  accentGradient: ['#3a8bff', '#1a5fd0'],
  gold: '#ffc23a',
  goldLedge: '#d99a00',
  goldSoft: 'rgba(245,176,0,0.16)',
  goldText: '#9a6700',
  onGold: '#2a1b00',
  goldGradient: ['#ffd25e', '#f5a300'],
};

// Cores das patentes, iguais ao js/main.js do site (sistema de XP)
export const RANKS = [
  { name: 'Bronze', min: 1, color: '#a5672f' },
  { name: 'Prata', min: 5, color: '#8a94a6' },
  { name: 'Ouro', min: 10, color: '#d4a017' },
  { name: 'Platina', min: 15, color: '#2fb6c4' },
  { name: 'Diamante', min: 20, color: '#6366f1' },
] as const;

/**
 * Cor de destaque por modalidade — ajuda a bater o olho numa lista e saber o
 * que é corrida, pedal, caminhada ou natação sem ler o texto.
 */
export const SPORT_COLORS: Record<string, string> = {
  Corrida: '#2f7dfd',
  Ciclismo: '#f59e0b',
  Caminhada: '#22c55e',
  Natação: '#06b6d4',
};

// Variantes da cor de modalidade pro modo daltonismo ativo. Protanopia e
// deuteranopia trocam o verde da Caminhada (risco clássico de confusão
// vermelho-verde) por um verde-azulado, e afastam o roxo da Natação do
// ciano/azul das outras duas. Tritanopia troca o eixo, então mantém
// vermelho/verde normais (não são o problema nesse tipo) e afasta a Natação
// do cian/azul, que é onde mora a confusão azul-amarelo.
const SPORT_COLORS_RG_SAFE: Record<string, string> = {
  Corrida: '#0072B2',
  Ciclismo: '#E69F00',
  Caminhada: '#009E73',
  Natação: '#CC79A7',
};
const SPORT_COLORS_BY_SAFE: Record<string, string> = {
  Corrida: '#2f7dfd',
  Ciclismo: '#DC2626',
  Caminhada: '#16A34A',
  Natação: '#9333EA',
};

/** Cor da modalidade, já ajustada pro modo de daltonismo ativo (se houver). */
export function sportColor(type: string, mode?: ColorBlindMode): string {
  const table = mode === 'tritanopia' ? SPORT_COLORS_BY_SAFE : mode ? SPORT_COLORS_RG_SAFE : SPORT_COLORS;
  return table[type] ?? table.Corrida;
}

/**
 * Cor de destaque por dificuldade de rota (Fácil/Moderada/Difícil) — usada em
 * Explorar Rotas e no detalhe da rota, antes duplicada como função local em
 * cada uma das duas telas.
 */
export function difficultyColor(difficulty: string, colors: Pick<TrainlyColors, 'success' | 'primary' | 'danger'>): string {
  if (difficulty === 'Fácil') return colors.success;
  if (difficulty === 'Difícil') return colors.danger;
  return colors.primary;
}

// Variantes das cores de patente pro modo daltonismo ativo. A paleta padrão
// (marrom/cinza/dourado/ciano/índigo) já não é um par vermelho-verde puro,
// então protanopia/deuteranopia trocam por um conjunto qualitativo
// (Okabe-Ito) igualmente distinguível, mas visivelmente diferente do padrão.
// Tritanopia é onde essa paleta tinha um risco de verdade — Platina (ciano) e
// Ouro (dourado) moram perto do eixo azul-amarelo que esse tipo confunde —
// então ali Platina vira verde e Ouro puxa mais pro laranja, saindo desse
// eixo.
const RANKS_RG_SAFE: Record<string, string> = {
  Bronze: '#D55E00',
  Prata: '#56B4E9',
  Ouro: '#E69F00',
  Platina: '#009E73',
  Diamante: '#CC79A7',
};
const RANKS_BY_SAFE: Record<string, string> = {
  Bronze: '#92400E',
  Prata: '#94A3B8',
  Ouro: '#F59E0B',
  Platina: '#16A34A',
  Diamante: '#9333EA',
};

/** Cor de uma patente pelo nome (Bronze/Prata/Ouro/Platina/Diamante) — pra
 *  moldura de avatar e cor do mapa personalizados. Cai pro Bronze se o nome
 *  não bater com nenhuma (defesa contra dado inconsistente). Passe o
 *  `colorBlindMode` de `useTheme()` pra já vir ajustada. */
export function tierColor(name: string, mode?: ColorBlindMode): string {
  const table = mode === 'tritanopia' ? RANKS_BY_SAFE : mode ? RANKS_RG_SAFE : null;
  if (table?.[name]) return table[name];
  return RANKS.find((r) => r.name === name)?.color ?? RANKS[0].color;
}

/** Cor com transparência a partir de um hex `#rrggbb` (ex: fundo de ícone). */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Clareia um hex `#rrggbb` misturando com branco (0 = igual, 1 = branco). */
export function lighten(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mixChannel = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mixChannel((n >> 16) & 255);
  const g = mixChannel((n >> 8) & 255);
  const b = mixChannel(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Os três tipos de daltonismo cobertos — cada um troca a rota errada de
 *  cores. `null`/`undefined` = nenhum ajuste (paleta padrão). */
export type ColorBlindMode = 'protanopia' | 'deuteranopia' | 'tritanopia' | null;

export interface AccessibilityOptions {
  /**
   * Troca as cores semânticas (sucesso/perigo/alerta) por uma paleta ajustada
   * pro tipo de daltonismo escolhido. O azul da marca (`primary`/`accent`)
   * não muda em nenhum modo — já é uma cor seguramente distinguível nos três
   * tipos, então mexer nela só tiraria identidade visual sem ganho.
   *
   * IMPORTANTE (honestidade sobre a precisão): protanopia e deuteranopia são
   * os dois tipos de confusão vermelho-verde — geneticamente diferentes, mas
   * o ajuste de cor que ajuda é quase o mesmo nos dois (evitar vermelho vs.
   * verde puros, usar contraste de claridade). Aqui eles usam paletas bem
   * parecidas, com uma pequena diferença de tom. Tritanopia (confusão
   * azul-amarelo, bem mais rara) é o caso realmente diferente, e usa uma
   * paleta própria. Nenhuma das três foi validada com software de simulação
   * — são escolhas informadas por guias de design acessível, não uma
   * correção calibrada por tipo.
   */
  colorBlindMode?: ColorBlindMode;
  /** Texto secundário e bordas mais fortes, pra mais contraste com o fundo. */
  highContrast?: boolean;
}

// Protanopia e deuteranopia: confusão vermelho-verde. Base Okabe-Ito
// (Okabe & Ito, 2008), que evita colocar vermelho e verde puros lado a lado.
const PROTANOPIA_SAFE = {
  success: '#0072B2', // azul forte — não compete com o eixo vermelho-verde
  danger: '#D55E00', // vermelhão/laranja-queimado, bem mais escuro que o warning
  warning: '#E69F00', // laranja claro
};

const DEUTERANOPIA_SAFE = {
  success: '#009E73', // verde-azulado (bluish green) — o "verde seguro" mais usado
  danger: '#CC3311', // vermelho-alaranjado, puxado pro laranja pra não ler como marrom
  warning: '#E69F00', // laranja
};

// Tritanopia: confusão azul-amarelo (rara). Aqui o problema é o oposto —
// vermelho e verde continuam distinguíveis, então mantemos tons "normais"
// pra eles e trocamos só o alerta, que normalmente é amarelo/laranja (fácil
// de confundir com rosa/roxo nesse tipo) por um roxo bem definido.
const TRITANOPIA_SAFE = {
  success: '#2E8B57', // verde-mar — a percepção de verde não é afetada
  danger: '#DC2626', // vermelho puro — idem
  warning: '#9333EA', // roxo, longe do eixo azul-amarelo que causa confusão
};

const COLOR_BLIND_PALETTES: Record<Exclude<ColorBlindMode, null | undefined>, { success: string; danger: string; warning: string }> = {
  protanopia: PROTANOPIA_SAFE,
  deuteranopia: DEUTERANOPIA_SAFE,
  tritanopia: TRITANOPIA_SAFE,
};

export interface StreakColors {
  fire: string;
  ice: string;
  rest: string;
}

// Cores fixas do streak (fora da paleta do app de propósito — ver
// `StreakBadge.tsx`), também ajustadas por modo. Laranja/azul (fogo/gelo) já
// é um par bem seguro pros três tipos, mas "descanso" (um azul bem escuro)
// ficava perto demais do gelo pra quem tem tritanopia — nesse modo troca por
// um cinza-arroxeado neutro, sem depender do eixo azul-amarelo.
export function streakColors(mode?: ColorBlindMode): StreakColors {
  if (mode === 'tritanopia') {
    return { fire: '#f97316', ice: '#38bdf8', rest: '#4b4458' };
  }
  return { fire: '#f97316', ice: '#38bdf8', rest: '#1e3a5f' };
}

function withHighContrast(c: TrainlyColors, mode: ThemeMode): TrainlyColors {
  return {
    ...c,
    // No escuro clareia o texto secundário; no claro escurece — os dois
    // reduzem a distância de contraste até o texto principal.
    textMuted: mode === 'dark' ? lighten(c.textMuted, 0.35) : mixTowardBlack(c.textMuted, 0.35),
    border: mode === 'dark' ? '#5a5096' : '#a9a0cc',
    // Degrau dos cards mais marcado também — é ele que separa card de fundo.
    ledge: mode === 'dark' ? '#000000' : '#b3aad6',
  };
}

/** Escurece um hex `#rrggbb` misturando com preto — irmã de `lighten`. */
export function mixTowardBlack(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mixChannel = (c: number) => Math.round(c * (1 - amount));
  const r = mixChannel((n >> 16) & 255);
  const g = mixChannel((n >> 8) & 255);
  const b = mixChannel(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function getColors(mode: ThemeMode, options?: AccessibilityOptions): TrainlyColors {
  let c = mode === 'dark' ? darkColors : lightColors;
  if (options?.colorBlindMode) {
    c = { ...c, ...COLOR_BLIND_PALETTES[options.colorBlindMode] };
  }
  if (options?.highContrast) {
    c = withHighContrast(c, mode);
  }
  return c;
}

/** Atalho legível pro degrau 3D de uma cor qualquer (botão, ícone de missão). */
export function ledgeOf(hex: string): string {
  return mixTowardBlack(hex, 0.32);
}
