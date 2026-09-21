import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export function TrainlyButton({ title, onPress, loading, variant = 'primary', disabled }: Props) {
  const { colors } = useTheme();

  const backgroundColor =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const borderColor = variant === 'secondary' ? colors.border : backgroundColor;
  const textColor = variant === 'secondary' ? colors.textPrimary : '#ffffff';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, borderColor, borderWidth: variant === 'secondary' ? 1 : 0 },
        (disabled || loading) && { opacity: 0.6 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
});
