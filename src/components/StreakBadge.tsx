import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { streakColors, withAlpha } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { effectiveStreak, StreakRow } from '../lib/streak';
import { Text } from './Typography';
import { tapLight } from '../lib/haptics';
import { RootStackParamList } from '../navigation/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  streak: StreakRow | null | undefined;
  /** Dono da sequência — abre a tela de detalhe dessa pessoa ao tocar. */
  userId: string | undefined;
  /** Nome de quem é a sequência — só pro título da tela (ex: "Sequência de Ana"). Omitido = tela da própria pessoa. */
  ownerFirstName?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/**
 * "Foguinho" de streak — visível no perfil de qualquer pessoa (a sua e a de
 * outros usuários), pra dar aquele empurrão social do "fulano tá numa
 * sequência boa". Sem streak nenhuma pra mostrar (`status: 'none'`), o
 * componente não renderiza nada — não faz sentido mostrar "0" logo de cara
 * pra quem nunca correu. Tocar abre a tela "Sequência" (calendário da
 * semana + atividades) em vez de só um alerta de texto.
 *
 * (Testamos uma versão "fundida" no anel da moldura — ficou bonita, mas
 * escondia demais a informação. Voltamos pra essa etiqueta separada, que é
 * o que realmente resolveu o problema original de "não encontro o streak".)
 */
export function StreakBadge({ streak, userId, ownerFirstName, size = 'md', style }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colorBlindMode } = useTheme();
  const { fire: FIRE, ice: ICE } = streakColors(colorBlindMode);
  const effective = effectiveStreak(streak);
  if (effective.status === 'none') return null;

  const frozen = effective.status === 'protected';
  const tint = frozen ? ICE : effective.status === 'needs_activity' ? withAlpha(FIRE, 0.75) : FIRE;
  const icon: IconName = frozen ? 'snow' : 'flame';
  const iconSize = size === 'sm' ? 12 : 14;

  const openDetail = () => {
    if (!userId) return;
    tapLight();
    navigation.navigate('Streak', { userId, name: ownerFirstName });
  };

  return (
    <Pressable
      onPress={openDetail}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Sequência de ${effective.count} semanas`}
      style={[
        styles.badge,
        size === 'sm' && styles.badgeSm,
        { backgroundColor: withAlpha(tint, 0.14), borderColor: withAlpha(tint, 0.32) },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={tint} />
      <Text style={[styles.count, size === 'sm' && styles.countSm, { color: tint }]}>{effective.count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeSm: { paddingHorizontal: 7, paddingVertical: 3 },
  count: { fontSize: 12.5, fontWeight: '800' },
  countSm: { fontSize: 11 },
});
