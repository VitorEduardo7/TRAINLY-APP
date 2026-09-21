import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

function getInitials(name: string): string {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface Props {
  name: string;
  size?: number;
}

// Avatar circular com iniciais do nome — mesmo padrão visual do ProfileScreen,
// reutilizado em qualquer lugar que mostre outro usuário (busca, feed).
export function Avatar({ name, size = 40 }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.avatarBg }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '800' },
});
