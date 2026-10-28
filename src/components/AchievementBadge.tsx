import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { achievementTierColor } from '../lib/achievements';
import { AchievementTier } from '../types/models';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: string;
  tier?: AchievementTier;
  unlocked: boolean;
  /** Secreta e ainda trancada: mostra "?" no lugar do ícone. */
  hidden?: boolean;
  size?: number;
}

/**
 * Medalha redonda de uma conquista: anel na cor do nível (bronze, prata,
 * ouro, lendária). Trancada fica cinza com um cadeadinho — mas ainda mostra
 * o ícone, pra dar vontade de ir atrás.
 */
export function AchievementBadge({ icon, tier, unlocked, hidden, size = 44 }: Props) {
  const { colors, colorBlindMode } = useTheme();
  const tint = achievementTierColor(tier, colorBlindMode);
  const iconSize = Math.round(size * 0.46);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: unlocked ? tint : colors.border,
            backgroundColor: unlocked ? withAlpha(tint, 0.16) : colors.surface,
          },
        ]}
      >
        <Ionicons
          name={(hidden ? 'help' : icon) as IconName}
          size={iconSize}
          color={unlocked ? tint : colors.textMuted}
          style={!unlocked && !hidden ? { opacity: 0.55 } : undefined}
        />
      </View>
      {!unlocked ? (
        <View style={[styles.lock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="lock-closed" size={9} color={colors.textMuted} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  lock: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
