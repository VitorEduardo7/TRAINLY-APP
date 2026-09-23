import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

interface Props extends ViewProps {
  /**
   * Cor (ou par de cores) de um traço de destaque no topo do card — usado
   * pra "assinar" um card com a cor da aba (ex: hero do Perfil) sem precisar
   * de um card inteiro colorido.
   */
  accent?: string | readonly [string, string];
}

export function Card({ style, children, accent, ...rest }: Props) {
  const { colors, mode } = useTheme();
  const accentColors: readonly [string, string] | undefined = accent
    ? Array.isArray(accent)
      ? (accent as readonly [string, string])
      : [accent as string, accent as string]
    : undefined;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        // No tema escuro a borda já separa o card do fundo; no claro, uma
        // sombra bem leve dá o relevo (sem ela o card "some" no cinza claro).
        mode === 'light' && [styles.lightShadow, { shadowColor: colors.shadow }],
        style,
      ]}
      {...rest}
    >
      {accentColors && (
        <LinearGradient
          colors={accentColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentBar}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  lightShadow: {
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 3,
    borderRadius: 3,
  },
});
