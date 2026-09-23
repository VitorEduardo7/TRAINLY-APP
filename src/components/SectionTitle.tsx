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

/** Título pequeno de seção, em caixa alta, igual em todas as telas. */
export function SectionTitle({ title, right, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 20 },
  title: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9 },
});
