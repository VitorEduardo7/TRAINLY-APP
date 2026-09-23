import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { lighten } from '../theme/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  /** Nome do ícone da patente (ver `emblemFor` em lib/rank). */
  icon: string;
  color: string;
  size?: number;
  /** Ainda não conquistada: fica "apagada", só com contorno tracejado. */
  locked?: boolean;
}

/** Emblema circular de uma patente, com o gradiente da cor dela. */
export function RankBadge({ icon, color, size = 44, locked }: Props) {
  const { colors } = useTheme();
  const glyph = icon as IconName;
  const iconSize = Math.round(size * 0.46);

  if (locked) {
    return (
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1.5,
            borderStyle: 'dashed',
          },
        ]}
      >
        <Ionicons name={glyph} size={iconSize} color={colors.textMuted} style={{ opacity: 0.45 }} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[lighten(color, 0.28), color]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Ionicons name={glyph} size={iconSize} color="#ffffff" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
