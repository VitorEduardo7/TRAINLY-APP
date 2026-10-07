import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

interface Props extends ViewProps {
  /**
   * Cor (ou par de cores) de um traço fino de destaque no topo do card —
   * "assina" um card sem pintar o card inteiro.
   */
  accent?: string | readonly [string, string];
  /** Mantido por compatibilidade (era "sem degrau" na versão Arena); hoje todo card é liso. */
  flat?: boolean;
}

/**
 * Peça base da identidade Noturno: bloco liso na cor do card, contorno de
 * 1px e cantos médios. Sem sombra e sem "degrau" — a hierarquia vem do
 * conteúdo (números grandes, títulos condensados), não do volume da caixa.
 */
export function Card({ style, children, accent, flat: _flat, ...rest }: Props) {
  const { colors } = useTheme();
  const accentColors: readonly [string, string] | undefined = accent
    ? Array.isArray(accent)
      ? (accent as readonly [string, string])
      : [accent as string, accent as string]
    : undefined;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]} {...rest}>
      {accentColors && (
        <LinearGradient colors={accentColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
});
