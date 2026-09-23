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

export function getColors(mode: ThemeMode): TrainlyColors {
  return mode === 'dark' ? darkColors : lightColors;
}
