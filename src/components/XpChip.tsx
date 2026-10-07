import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Text } from './Typography';

/**
 * "+80 XP" — o número em dourado, a sigla discreta. XP é a "medalha" do app:
 * mesma cor e mesmo formato em toda tela (Início, Histórico, Sequência,
 * Conquistas), pra pessoa reconhecer de relance. Sem caixinha em volta: é
 * só tipografia, alinhada à direita da linha.
 */
export function XpChip({ xp }: { xp: number; label?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={`${xp} XP`}>
      <Text style={[styles.value, { color: colors.goldText }]}>+{xp}</Text>
      <Text style={[styles.unit, { color: colors.textMuted }]}> XP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  unit: { fontSize: 11.5, fontWeight: '600' },
});
