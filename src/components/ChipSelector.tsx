import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
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
 * Seletor de "chips" em pílula (tipo de atividade, dificuldade da rota...),
 * a opção escolhida destacada na cor primária. Substitui 3 versões quase
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
              {
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? withAlpha(colors.primary, 0.13) : 'transparent',
              },
            ]}
          >
            <Text style={[styles.label, { color: active ? colors.primary : colors.textMuted }]}>{option}</Text>
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
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  label: { fontSize: 13, fontWeight: '700' },
});
