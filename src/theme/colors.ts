// Paleta oficial do Trainly, extraída de css/global.css do site.
// Mantém os mesmos tokens para dark e light, então qualquer tela
// que use `theme.colors.x` funciona nos dois modos automaticamente.

export type ThemeMode = 'dark' | 'light';

export interface TrainlyColors {
  primary: string;
  primaryHover: string;
  background: string;
  card: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  avatarBg: string;
  danger: string;
  success: string;
  white: string;
  /** Superfície um degrau acima do card (chips, campos dentro de um card). */
  surface: string;
  /** Primária translúcida — fundo de ícones e destaques suaves. */
  primarySoft: string;
  /** Gradiente da marca (botão principal, barras de progresso, destaques). */
  gradient: readonly [string, string];
  warning: string;
  /** Cor da sombra dos cards (só aparece de verdade no tema claro). */
  shadow: string;
  /**
   * "Segundo tom" de destaque do redesign — a pedido do usuário, usa o
   * próprio azul da marca em vez de uma cor nova (a versão anterior usava um
   * verde-limão; ficou só a mudança de layout, sem cor nova).
   */
  accent: string;
  accentSoft: string;
  accentGradient: readonly [string, string];
}

/**
 * Par de cores usado nos "blobs" de fundo do cabeçalho (`GradientBackdrop`).
 * Antes cada aba tinha uma cor própria (coral, dourado, ciano...); a pedido
 * do usuário isso foi removido — todas usam o mesmo azul da marca agora, só
 * o formato "hero" arredondado do cabeçalho foi mantido.
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
  background: '#0a0b0f',
  card: '#14161f',
  textPrimary: '#f2f3f6',
  textMuted: '#9a9caa',
  border: 'rgba(255,255,255,0.08)',
  avatarBg: '#2b5d34',
  danger: '#f0554e',
  success: '#22c55e',
  white: '#ffffff',
  surface: '#1b1e29',
  primarySoft: 'rgba(47,125,253,0.14)',
  gradient: ['#4a93ff', '#1f5ee8'],
  warning: '#f59e0b',
  shadow: '#000000',
  accent: '#2f7dfd',
  accentSoft: 'rgba(47,125,253,0.14)',
  accentGradient: ['#4a93ff', '#1f5ee8'],
};

export const lightColors: TrainlyColors = {
  primary: '#267cee',
  primaryHover: '#1a63c6',
  background: '#f4f5f7',
  card: '#ffffff',
  textPrimary: '#242428',
  textMuted: '#666666',
  border: '#e6e6eb',
  avatarBg: '#2b5d34',
  danger: '#e0473e',
  success: '#22c55e',
  white: '#ffffff',
  surface: '#f1f3f7',
  primarySoft: 'rgba(38,124,238,0.10)',
  gradient: ['#3a8bff', '#1a5fd0'],
  warning: '#d97706',
  shadow: '#1b2a4a',
  accent: '#267cee',
  accentSoft: 'rgba(38,124,238,0.10)',
  accentGradient: ['#3a8bff', '#1a5fd0'],
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

/** Cor de uma patente pelo nome (Bronze/Prata/Ouro/Platina/Diamante) — pra
 *  moldura de avatar e cor do mapa personalizados. Cai pro Bronze se o nome
 *  não bater com nenhuma (defesa contra dado inconsistente). */
export function tierColor(name: string): string {
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
    border: mode === 'dark' ? 'rgba(255,255,255,0.22)' : '#b8b8c2',
  };
}

/** Escurece um hex `#rrggbb` misturando com preto — irmã de `lighten`. */
function mixTowardBlack(hex: string, amount: number): string {
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
