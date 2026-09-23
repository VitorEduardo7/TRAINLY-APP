import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { Skeleton } from './Skeleton';
import { Text } from './Typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IconName;
  label: string;
  value: string;
  /** Cor do ícone (padrão: primária). */
  tint?: string;
  /** `lg` = tile de destaque (número maior, mais respiro) — pra 1 estatística "hero". */
  size?: 'md' | 'lg';
  /** Fundo em degradê (substitui `surface`) — reserva pra tile de destaque com cor própria. */
  gradient?: readonly [string, string];
  /** Mostra esqueleto pulsando no lugar do valor (primeira carga). */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Quadradinho de número: ícone, valor grande e rótulo — pra grades de resumo. */
export function StatTile({ icon, label, value, tint, size = 'md', gradient, loading, style }: Props) {
  const { colors } = useTheme();
  const color = tint ?? colors.primary;
  const onGradient = !!gradient;
  const iconBg = onGradient
    ? withAlpha('#ffffff', 0.22)
    : color.startsWith('#')
      ? withAlpha(color, 0.16)
      : colors.primarySoft;
  const iconColor = onGradient ? '#ffffff' : color;
  const valueColor = onGradient ? '#ffffff' : colors.textPrimary;
  const labelColor = onGradient ? withAlpha('#ffffff', 0.85) : colors.textMuted;

  return (
    <View
      style={[
        styles.tile,
        size === 'lg' && styles.tileLg,
        !onGradient && { backgroundColor: colors.surface },
        style,
      ]}
    >
      {onGradient && (
        <LinearGradient colors={gradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.95, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <View style={[styles.icon, size === 'lg' && styles.iconLg, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={size === 'lg' ? 18 : 15} color={iconColor} />
      </View>
      {loading ? (
        <Skeleton width={size === 'lg' ? '55%' : '70%'} height={size === 'lg' ? 24 : 16} style={{ marginTop: 2 }} />
      ) : (
        <Text
          style={[size === 'lg' ? styles.valueLg : styles.value, { color: valueColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {value}
        </Text>
      )}
      <Text style={[styles.label, { color: labelColor }, loading && { marginTop: 8 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 16, padding: 12, flexGrow: 1, flexBasis: '46%', overflow: 'hidden' },
  tileLg: { flexBasis: '100%', padding: 18, borderRadius: 22 },
  icon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  iconLg: { width: 36, height: 36, borderRadius: 12, marginBottom: 14 },
  value: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  valueLg: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  label: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
});
