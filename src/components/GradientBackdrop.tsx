import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';

interface Props {
  /** Par de cores da aba (ver `SCREEN_WASH`). */
  wash: readonly [string, string];
}

/**
 * Dois "blobs" de gradiente atrás do cabeçalho de cada aba — sem `expo-blur`
 * no projeto, então o efeito de "glow" vem de círculos grandes e bem
 * transparentes que se dissolvem no fundo por baixo de um degradê vertical.
 * É isso que dá a cada tela uma identidade de cor própria (o pedido de
 * "fugir um pouco do site", que era só azul em tudo).
 */
export function GradientBackdrop({ wash }: Props) {
  const { colors, mode } = useTheme();
  const { width } = useWindowDimensions();
  const strength = mode === 'dark' ? 1 : 0.6;

  const sizeA = width * 0.95;
  const sizeB = width * 0.72;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[
          styles.blob,
          {
            width: sizeA,
            height: sizeA,
            borderRadius: sizeA / 2,
            top: -sizeA * 0.42,
            left: -sizeA * 0.28,
            opacity: strength,
          },
        ]}
      >
        <LinearGradient
          colors={[withAlpha(wash[0], 0.55), withAlpha(wash[0], 0)]}
          start={{ x: 0.2, y: 0.15 }}
          end={{ x: 0.85, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        style={[
          styles.blob,
          {
            width: sizeB,
            height: sizeB,
            borderRadius: sizeB / 2,
            top: -sizeB * 0.3,
            right: -sizeB * 0.32,
            opacity: strength,
          },
        ]}
      >
        <LinearGradient
          colors={[withAlpha(wash[1], 0.5), withAlpha(wash[1], 0)]}
          start={{ x: 0.85, y: 0.1 }}
          end={{ x: 0.1, y: 0.95 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <LinearGradient
        colors={['transparent', colors.background]}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', overflow: 'hidden' },
});
