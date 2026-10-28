import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { selection } from '../lib/haptics';
import { prefersReducedMotion } from './Motion';
import { Text } from './Typography';

interface Props<T extends string> {
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Abas lado a lado com um "trilho" que desliza até a opção ativa — o mesmo
 * seletor do login (Entrar / Criar conta), usado pra dividir uma tela em duas
 * partes (ex: Publicações / Atletas na aba Amigos).
 */
export function SegmentedTabs<T extends string>({ options, value, onChange, style }: Props<T>) {
  const { colors, mode } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      x.setValue(index);
      return;
    }
    Animated.spring(x, { toValue: index, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [index, x]);

  const segment = width > 0 ? (width - 8) / options.length : 0;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
      accessibilityRole="tablist"
    >
      {segment > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segment,
              backgroundColor: withAlpha(colors.primary, mode === 'dark' ? 0.22 : 0.12),
              borderColor: withAlpha(colors.primary, 0.55),
              transform: [{ translateX: Animated.multiply(x, segment) }],
            },
          ]}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!active) selection();
              onChange(o.value);
            }}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, { color: active ? colors.textPrimary : colors.textMuted }]}>
              {o.label}
              {o.count != null && o.count > 0 ? ` · ${o.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1 },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 10, borderWidth: 1 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  label: { fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
});
