import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SPORT_COLORS, withAlpha } from '../theme/colors';

/**
 * Ícones das modalidades (corrida, pedal, natação, caminhada) desenhados em
 * SVG no lugar dos emojis. Os traçados são do Material Design Icons
 * (Pictogrammers, licença Apache 2.0 — pictogrammers.com/library/mdi):
 * `mdiRunFast`, `mdiBike`, `mdiSwim` e `mdiWalk`.
 *
 * SVG em vez de mais uma fonte de ícones: o pacote de ícones que tem essas
 * modalidades pesa 1,3 MB, baixado inteiro no Expo Go só pra 4 desenhos.
 * Aqui são 4 textos curtos, já dentro do app.
 */
const PATHS: Record<string, string> = {
  Corrida:
    'M16.5,5.5A2,2 0 0,0 18.5,3.5A2,2 0 0,0 16.5,1.5A2,2 0 0,0 14.5,3.5A2,2 0 0,0 16.5,5.5M12.9,19.4L13.9,15L16,17V23H18V15.5L15.9,13.5L16.5,10.5C17.89,12.09 19.89,13 22,13V11C20.24,11.03 18.6,10.11 17.7,8.6L16.7,7C16.34,6.4 15.7,6 15,6C14.7,6 14.5,6.1 14.2,6.1L9,8.3V13H11V9.6L12.8,8.9L11.2,17L6.3,16L5.9,18L12.9,19.4M4,9A1,1 0 0,1 3,8A1,1 0 0,1 4,7H7V9H4M5,5A1,1 0 0,1 4,4A1,1 0 0,1 5,3H10V5H5M3,13A1,1 0 0,1 2,12A1,1 0 0,1 3,11H7V13H3Z',
  Ciclismo:
    'M5,20.5A3.5,3.5 0 0,1 1.5,17A3.5,3.5 0 0,1 5,13.5A3.5,3.5 0 0,1 8.5,17A3.5,3.5 0 0,1 5,20.5M5,12A5,5 0 0,0 0,17A5,5 0 0,0 5,22A5,5 0 0,0 10,17A5,5 0 0,0 5,12M14.8,10H19V8.2H15.8L13.86,4.93C13.57,4.43 13,4.1 12.4,4.1C11.93,4.1 11.5,4.29 11.2,4.6L7.5,8.29C7.19,8.6 7,9 7,9.5C7,10.13 7.33,10.66 7.85,10.97L11.2,13V18H13V11.5L10.75,9.85L13.07,7.5M19,20.5A3.5,3.5 0 0,1 15.5,17A3.5,3.5 0 0,1 19,13.5A3.5,3.5 0 0,1 22.5,17A3.5,3.5 0 0,1 19,20.5M19,12A5,5 0 0,0 14,17A5,5 0 0,0 19,22A5,5 0 0,0 24,17A5,5 0 0,0 19,12M16,4.8C17,4.8 17.8,4 17.8,3C17.8,2 17,1.2 16,1.2C15,1.2 14.2,2 14.2,3C14.2,4 15,4.8 16,4.8Z',
  Natação:
    'M2,18C4.22,17 6.44,16 8.67,16C10.89,16 13.11,18 15.33,18C17.56,18 19.78,16 22,16V19C19.78,19 17.56,21 15.33,21C13.11,21 10.89,19 8.67,19C6.44,19 4.22,20 2,21V18M8.67,13C7.89,13 7.12,13.12 6.35,13.32L11.27,9.88L10.23,8.64C10.09,8.47 10,8.24 10,8C10,7.66 10.17,7.35 10.44,7.17L16.16,3.17L17.31,4.8L12.47,8.19L17.7,14.42C16.91,14.75 16.12,15 15.33,15C13.11,15 10.89,13 8.67,13M18,7A2,2 0 0,1 20,9A2,2 0 0,1 18,11A2,2 0 0,1 16,9A2,2 0 0,1 18,7Z',
  Caminhada:
    'M14.12,10H19V8.2H15.38L13.38,4.87C13.08,4.37 12.54,4.03 11.92,4.03C11.74,4.03 11.58,4.06 11.42,4.11L6,5.8V11H7.8V7.33L9.91,6.67L6,22H7.8L10.67,13.89L13,17V22H14.8V15.59L12.31,11.05L13.04,8.18M14,3.8C15,3.8 15.8,3 15.8,2C15.8,1 15,0.2 14,0.2C13,0.2 12.2,1 12.2,2C12.2,3 13,3.8 14,3.8Z',
};

export function sportColor(type: string): string {
  return SPORT_COLORS[type] ?? SPORT_COLORS.Corrida;
}

/** Só o desenho, na cor pedida (ex: dentro de um chip ou de um texto). */
export function SportGlyph({ type, size = 20, color }: { type: string; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={PATHS[type] ?? PATHS.Corrida} fill={color ?? sportColor(type)} />
    </Svg>
  );
}

/** Desenho num quadrado arredondado com a cor da modalidade ao fundo. */
export function SportBadge({ type, size = 42, style }: { type: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const color = sportColor(type);
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: withAlpha(color, 0.14) },
        style,
      ]}
    >
      <SportGlyph type={type} size={size * 0.56} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
