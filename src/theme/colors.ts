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
}

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
};

// Cores das patentes, iguais ao js/main.js do site (sistema de XP)
export const RANKS = [
  { name: 'Bronze', min: 1, color: '#a5672f' },
  { name: 'Prata', min: 5, color: '#8a94a6' },
  { name: 'Ouro', min: 10, color: '#d4a017' },
  { name: 'Platina', min: 15, color: '#2fb6c4' },
  { name: 'Diamante', min: 20, color: '#6366f1' },
] as const;

export function getColors(mode: ThemeMode): TrainlyColors {
  return mode === 'dark' ? darkColors : lightColors;
}
