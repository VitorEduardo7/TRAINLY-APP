import React, { useId } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  /** De 0 a 1 (valores fora disso são limitados). */
  progress: number;
  /** Quantos "parciais" a barra tem. */
  segments?: number;
  height?: number;
  /** Cor dos parciais completos (padrão: azul da marca). */
  color?: string;
  trackColor?: string;
  /** Espaço entre parciais, em px. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Barra de progresso em PARCIAIS inclinados — como as parciais de uma prova
 * (cada volta, cada km) ou o mostrador de um relógio esportivo. É a
 * assinatura visual do app: XP, missões e meta do mês usam essa barra, em vez
 * de uma barra lisa genérica. O parcial em andamento enche só até onde
 * chegou (corte seco na cor, sem degradê).
 *
 * Desenhada em SVG (e não com `transform: skewX`) pra ficar igual no Android
 * e no iPhone.
 */
export function SegmentedBar({ progress, segments = 12, height = 8, color, trackColor, gap = 3, style }: Props) {
  const { colors } = useTheme();
  const uid = `seg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const filled = p * segments;
  const fill = color ?? colors.primary;
  const track = trackColor ?? colors.surface;
  // Inclinação de cada parcial: o topo "anda" pra direita ~0.6x a altura.
  const slant = 0.6;

  return (
    <View style={[styles.row, { height, gap }, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      {Array.from({ length: segments }, (_, i) => {
        const amount = Math.max(0, Math.min(1, filled - i));
        const id = `${uid}_${i}`;
        return (
          <View key={i} style={styles.cell}>
            <Svg width="100%" height="100%" viewBox="0 0 100 10" preserveAspectRatio="none">
              {amount > 0 && amount < 1 ? (
                <Defs>
                  <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset={amount} stopColor={fill} />
                    <Stop offset={amount} stopColor={track} />
                  </LinearGradient>
                </Defs>
              ) : null}
              <Polygon
                points={`${slant * 10 * 2},0 100,0 ${100 - slant * 10 * 2},10 0,10`}
                fill={amount >= 1 ? fill : amount > 0 ? `url(#${id})` : track}
              />
            </Svg>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', width: '100%' },
  cell: { flex: 1 },
});
