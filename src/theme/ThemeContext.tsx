import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorBlindMode, getColors, ThemeMode, TrainlyColors } from './colors';

export type FontScale = 'normal' | 'large' | 'xlarge';

/** Multiplicador aplicado a todo `fontSize` pelo `Text`/`TextInput` (ver `components/Typography.tsx`). */
export const FONT_SCALE_MULTIPLIER: Record<FontScale, number> = {
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
};

interface ThemeContextValue {
  mode: ThemeMode;
  colors: TrainlyColors;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
  /** Modo de paleta segura pra daltonismo — `null` = desligado (ver `theme/colors.ts`). */
  colorBlindMode: ColorBlindMode;
  setColorBlindMode: (v: ColorBlindMode) => void;
  /** Mais contraste entre texto secundário/bordas e o fundo. */
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  fontScale: FontScale;
  setFontScale: (v: FontScale) => void;
}

const THEME_KEY = 'trainly_theme';
/** Chave nova (guarda o modo: 'protanopia'/'deuteranopia'/'tritanopia'/'none'). */
const COLOR_BLIND_MODE_KEY = 'trainly_a11y_colorblind_mode';
/** Chave antiga (toggle único on/off) — só lida pra migrar quem já tinha ligado. */
const LEGACY_COLOR_BLIND_KEY = 'trainly_a11y_colorblind';
const HIGH_CONTRAST_KEY = 'trainly_a11y_contrast';
const FONT_SCALE_KEY = 'trainly_a11y_font_scale';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    Appearance.getColorScheme() === 'light' ? 'light' : 'dark',
  );
  const [colorBlindMode, setColorBlindModeState] = useState<ColorBlindMode>(null);
  const [highContrast, setHighContrastState] = useState(false);
  const [fontScale, setFontScaleState] = useState<FontScale>('normal');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setModeState(saved);
    });
    AsyncStorage.getItem(COLOR_BLIND_MODE_KEY).then((saved) => {
      if (saved === 'protanopia' || saved === 'deuteranopia' || saved === 'tritanopia') {
        setColorBlindModeState(saved);
        return;
      }
      if (saved === 'none') return;
      // Sem valor salvo na chave nova: migra quem já tinha o toggle antigo
      // ligado pra deuteranopia (era a paleta que esse toggle usava).
      AsyncStorage.getItem(LEGACY_COLOR_BLIND_KEY).then((legacy) => {
        if (legacy === '1') {
          setColorBlindModeState('deuteranopia');
          AsyncStorage.setItem(COLOR_BLIND_MODE_KEY, 'deuteranopia').catch(() => {});
        }
      });
    });
    AsyncStorage.getItem(HIGH_CONTRAST_KEY).then((saved) => {
      if (saved === '1') setHighContrastState(true);
    });
    AsyncStorage.getItem(FONT_SCALE_KEY).then((saved) => {
      if (saved === 'large' || saved === 'xlarge') setFontScaleState(saved);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  };

  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const setColorBlindMode = (v: ColorBlindMode) => {
    setColorBlindModeState(v);
    AsyncStorage.setItem(COLOR_BLIND_MODE_KEY, v ?? 'none').catch(() => {});
  };

  const setHighContrast = (v: boolean) => {
    setHighContrastState(v);
    AsyncStorage.setItem(HIGH_CONTRAST_KEY, v ? '1' : '0').catch(() => {});
  };

  const setFontScale = (v: FontScale) => {
    setFontScaleState(v);
    AsyncStorage.setItem(FONT_SCALE_KEY, v).catch(() => {});
  };

  const value = useMemo(
    () => ({
      mode,
      colors: getColors(mode, { colorBlindMode, highContrast }),
      toggle,
      setMode,
      colorBlindMode,
      setColorBlindMode,
      highContrast,
      setHighContrast,
      fontScale,
      setFontScale,
    }),
    [mode, colorBlindMode, highContrast, fontScale],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
