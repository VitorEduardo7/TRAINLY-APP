import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getColors, ThemeMode, TrainlyColors } from './colors';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: TrainlyColors;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

const THEME_KEY = 'trainly_theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    Appearance.getColorScheme() === 'light' ? 'light' : 'dark',
  );

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  };

  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const value = useMemo(
    () => ({ mode, colors: getColors(mode), toggle, setMode }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
