import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Text } from './Typography';

interface Props {
  title: string;
  /** Algo alinhado à direita na mesma linha (ex: "ver tudo", total, botão). */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Título de seção: frase normal (sem caixa alta), em Barlow Condensed na
 * cor do texto principal — o mesmo tom de "manchete de placar" dos números.
 */
export function SectionTitle({ title, right, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 22, gap: 10 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: 0.1, flexShrink: 1 },
});
