import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Text, TextInput } from './Typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props extends TextInputProps {
  label: string;
  /** Conteúdo opcional alinhado à direita, na mesma linha do label (ex: um link de atalho). */
  labelRight?: React.ReactNode;
  /** Ícone opcional dentro do campo, à esquerda. */
  icon?: IconName;
}

export function TrainlyInput({ label, labelRight, icon, style, secureTextEntry, onFocus, onBlur, multiline, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  // Campo de senha ganha o "olhinho" pra mostrar/esconder o que foi digitado.
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        {labelRight}
      </View>
      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          { backgroundColor: colors.card, borderColor: focused ? colors.primary : colors.border },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.primary : colors.textMuted}
            style={[styles.icon, multiline && { marginTop: 13 }]}
          />
        ) : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!!secureTextEntry && hidden}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            { color: colors.textPrimary, paddingLeft: icon ? 10 : 14 },
            style,
          ]}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Esconder senha'}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 13,
    minHeight: 50,
  },
  fieldMultiline: { alignItems: 'flex-start' },
  icon: { marginLeft: 14 },
  input: {
    flex: 1,
    paddingRight: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  eye: { paddingHorizontal: 14, alignSelf: 'stretch', justifyContent: 'center' },
});
