import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
   * primary = azul da marca · secondary = neutro · danger = vermelho cheio ·
   * dangerOutline = só contorno vermelho (ações destrutivas que não devem
   * gritar, tipo "Cancelar troca") · gold = recompensa/conquista.
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'gold';
  disabled?: boolean;
  /** Ícone opcional à esquerda do texto. */
  icon?: IconName;
  /** `sm` = versão compacta, pra cabeçalhos e linhas de lista. `lg` = ação principal da tela. */
  size?: 'sm' | 'md' | 'lg';
  /** Rótulo pra leitor de tela quando o título sozinho não basta (obrigatório com `square`). */
  accessibilityLabel?: string;
  /** Botão quadrado só com o ícone (ex: "+" ao lado de "Iniciar corrida"). */
  square?: boolean;
}

/**
 * Botão da identidade Noturno: bloco liso de cor cheia (ou superfície com
 * contorno fino, no secundário) e o rótulo em Barlow Condensed — a mesma
 * letra dos números grandes, que dá o tom esportivo sem precisar de volume.
 */
export function TrainlyButton({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
  icon,
  size = 'md',
  accessibilityLabel,
  square,
}: Props) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const small = size === 'sm';
  const large = size === 'lg';

  const fill =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'gold'
          ? colors.gold
          : variant === 'dangerOutline'
            ? withAlpha(colors.danger, 0.1)
            : colors.surface;

  const textColor =
    variant === 'secondary'
      ? colors.textPrimary
      : variant === 'dangerOutline'
        ? colors.danger
        : variant === 'gold'
          ? colors.onGold
          : '#ffffff';

  const content = loading ? (
    <ActivityIndicator color={textColor} size={small ? 'small' : undefined} />
  ) : (
    <View style={styles.content}>
      {icon ? <Ionicons name={icon} size={square ? (large ? 26 : 22) : small ? 15 : large ? 20 : 18} color={textColor} /> : null}
      {square ? null : (
        <Text style={[styles.text, small && styles.textSm, large && styles.textLg, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={() => {
        tapLight();
        onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (square ? title : undefined)}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={isDisabled ? styles.disabled : undefined}
    >
      <View
        style={[
          styles.base,
          small && styles.baseSm,
          large && styles.baseLg,
          square && { paddingHorizontal: 0, width: large ? 58 : small ? 36 : 52 },
          { backgroundColor: fill, borderColor: 'transparent' },
          variant === 'dangerOutline' && { borderColor: withAlpha(colors.danger, 0.45) },
          variant === 'secondary' && { borderColor: colors.border },
        ]}
      >
        {content}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  baseSm: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  baseLg: {
    borderRadius: 16,
    minHeight: 58,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontSize: 19, fontWeight: '800', letterSpacing: 0.3 },
  textSm: { fontSize: 16 },
  textLg: { fontSize: 22 },
  disabled: { opacity: 0.5 },
});
