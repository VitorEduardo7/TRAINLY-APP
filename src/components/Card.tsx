import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function Card({ style, children, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
  },
});
