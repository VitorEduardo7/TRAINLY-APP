import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { lighten, mixTowardBlack, withAlpha } from '../theme/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  /** Nome do ícone da patente (ver `emblemFor` em lib/rank). */
  icon: string;
  color: string;
  /** Largura do emblema; a altura sai proporcional. */
  size?: number;
  /** Ainda não conquistada: só o contorno, apagado. */
  locked?: boolean;
}

// Hexágono "em pé" desenhado num quadro de 100x115 e escalado pelo `size`.
const VB_W = 100;
const VB_H = 115.47;
const OUTER = '50,1 99,29 99,86.5 50,114.5 1,86.5 1,29';
const INNER = '50,9 92,33 92,82.5 50,106.5 8,82.5 8,33';

/** Altura total do emblema pra uma dada largura (útil pra alinhar coisas em volta). */
export function rankBadgeHeight(size: number): number {
  return (size * VB_H) / VB_W;
}

/**
 * Emblema de patente: um hexágono "brasão" no metal da patente (claro em
 * cima, escuro embaixo) com um filete interno fino — mais distintivo de
 * uniforme do que de desenho animado. Desenhado em SVG, sem imagem pronta:
 * troca de cor sozinho com o modo de daltonismo (a cor vem de `tierColor`).
 */
export function RankBadge({ icon, color, size = 44, locked }: Props) {
  const { colors } = useTheme();
  const gid = `rank${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const height = rankBadgeHeight(size);
  const glyph = icon as IconName;
  const iconSize = Math.round(size * 0.42);
  const strokeW = size < 40 ? 4 : 3;

  return (
    <View style={{ width: size, height }}>
      <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {locked ? (
          <Polygon points={OUTER} fill="transparent" stroke={colors.border} strokeWidth={strokeW} />
        ) : (
          <>
            <Defs>
              <LinearGradient id={gid} x1="0.2" y1="0" x2="0.8" y2="1">
                <Stop offset="0" stopColor={lighten(color, 0.38)} />
                <Stop offset="0.5" stopColor={color} />
                <Stop offset="1" stopColor={mixTowardBlack(color, 0.35)} />
              </LinearGradient>
            </Defs>
            <Polygon points={OUTER} fill={`url(#${gid})`} />
            <Polygon points={INNER} fill="none" stroke={withAlpha('#ffffff', 0.38)} strokeWidth={strokeW * 0.6} />
          </>
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <Ionicons
          name={glyph}
          size={iconSize}
          color={locked ? colors.textMuted : '#ffffff'}
          style={locked ? { opacity: 0.55 } : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
