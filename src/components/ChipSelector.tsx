import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { PressableScale } from './Motion';
import { Text } from './Typography';
import { selection } from '../lib/haptics';

interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Seletor de "chips" (tipo de atividade, dificuldade da rota...): opções com
 * contorno fino; a escolhida vira azul cheio. Substitui 3 versões quase
 * idênticas que existiam soltas (RunScreen, RegisterActivityModal,
 * PublishRouteModal — cada uma um <Text onPress> sem nenhum feedback ao
 * tocar). Aqui com PressableScale + vibração de seleção.
 */
export function ChipSelector<T extends string>({ options, value, onChange, style }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, style]}>
      {options.map((option) => {
        const active = option === value;
        return (
          <PressableScale
            key={option}
            onPress={() => {
              if (option !== value) selection();
              onChange(option);
            }}
            scaleTo={0.95}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              active
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: 'transparent', borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: active ? '#ffffff' : colors.textMuted }]}>{option}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  label: { fontSize: 13.5, fontWeight: '600' },
});
