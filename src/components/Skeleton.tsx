import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { prefersReducedMotion } from './Motion';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bloco "fantasma" pulsando no lugar do conteúdo enquanto ele carrega — no
 * lugar de uma tela vazia ou de um "0,00 km" provisório que parece dado real.
 */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  const { mode } = useTheme();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(24,36,64,0.08)',
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/** Cartão genérico carregando: ícone + duas linhas + faixa de números. */
export function SkeletonCard({ lines = 2, withStats = true }: { lines?: number; withStats?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Skeleton width={42} height={42} radius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="65%" height={13} />
          {lines > 1 && <Skeleton width="40%" height={11} />}
        </View>
      </View>
      {withStats && (
        <View style={[styles.stats, { borderColor: colors.border }]}>
          <Skeleton width="24%" height={16} />
          <Skeleton width="24%" height={16} />
          <Skeleton width="24%" height={16} />
        </View>
      )}
    </View>
  );
}

/** Linha simples carregando (listas dentro de um card). */
export function SkeletonRow() {
  return (
    <View style={[styles.row, { paddingVertical: 10 }]}>
      <Skeleton width={40} height={40} radius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="70%" height={12} />
        <Skeleton width="45%" height={10} />
      </View>
      <Skeleton width={48} height={20} radius={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 14,
  },
});
