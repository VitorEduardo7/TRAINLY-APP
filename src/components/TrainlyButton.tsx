import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { PressableScale } from './Motion';
import { Text } from './Typography';
import { tapLight } from '../lib/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  /**
   * primary = gradiente da marca · secondary = contorno neutro ·
   * danger = vermelho cheio · dangerOutline = só contorno vermelho (ações
   * destrutivas que não devem gritar, tipo "Sair da conta").
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerOutline';
  disabled?: boolean;
  /** Ícone opcional à esquerda do texto. */
  icon?: IconName;
  /** `sm` = versão compacta, pra cabeçalhos e linhas de lista. */
  size?: 'md' | 'sm';
}

export function TrainlyButton({ title, onPress, loading, variant = 'primary', disabled, icon, size = 'md' }: Props) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const small = size === 'sm';

  const textColor =
    variant === 'secondary' ? colors.textPrimary : variant === 'dangerOutline' ? colors.danger : '#ffffff';

  const content = loading ? (
    <ActivityIndicator color={textColor} size={small ? 'small' : undefined} />
  ) : (
    <View style={styles.content}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={textColor} /> : null}
      <Text style={[styles.text, small && styles.textSm, { color: textColor }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );

  const shape = [styles.base, small && styles.baseSm];

  return (
    <PressableScale
      onPress={() => {
        tapLight();
        onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={isDisabled ? styles.disabled : undefined}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[shape, !small && Platform.OS === 'ios' && [styles.glow, { shadowColor: colors.primary }]]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            shape,
            variant === 'secondary' && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
            variant === 'danger' && { backgroundColor: colors.danger },
            variant === 'dangerOutline' && {
              backgroundColor: withAlpha(colors.danger, 0.08),
              borderColor: withAlpha(colors.danger, 0.35),
              borderWidth: 1,
            },
          ]}
        >
          {content}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  baseSm: {
    borderRadius: 11,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 38,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
  textSm: { fontSize: 13.5 },
  disabled: { opacity: 0.55 },
  glow: { shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
});
