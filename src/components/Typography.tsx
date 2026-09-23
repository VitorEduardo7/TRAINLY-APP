import React, { createContext, forwardRef, useContext } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  StyleProp,
} from 'react-native';
import { interFamily, useFontsReady } from '../theme/fonts';

/**
 * `Text` e `TextInput` do app: iguais aos do React Native, só que aplicam a
 * fonte Inter no peso certo (ver `interFamily`). Todas as telas importam
 * daqui em vez de 'react-native', então a tipografia fica consistente sem
 * precisar lembrar de `fontFamily` em cada estilo.
 */

/** Marca que estamos dentro de outro <Text> — texto aninhado herda a fonte do pai. */
const InsideText = createContext(false);

function fontOverride(style: StyleProp<TextStyle>, nested: boolean, ready: boolean): TextStyle | null {
  if (!ready) return null;
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  // Família escolhida à mão (ex: fonte dos ícones) sempre manda.
  if (flat.fontFamily) return null;
  // Texto aninhado sem peso próprio: deixa herdar do pai (ex: o "ly" azul de
  // "Trainly" continua no mesmo peso da palavra).
  if (nested && flat.fontWeight == null) return null;
  // `fontWeight: 'normal'` junto: o arquivo escolhido já É o peso certo; sem
  // isso o Android aplicaria um negrito sintético por cima.
  return { fontFamily: interFamily(flat.fontWeight), fontWeight: 'normal' };
}

export function Text({ style, children, ...rest }: TextProps) {
  const ready = useFontsReady();
  const nested = useContext(InsideText);
  const override = fontOverride(style, nested, ready);
  return (
    <RNText {...rest} style={override ? [style, override] : style}>
      <InsideText.Provider value={true}>{children}</InsideText.Provider>
    </RNText>
  );
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  const ready = useFontsReady();
  const override = fontOverride(style, false, ready);
  return <RNTextInput ref={ref} {...rest} style={override ? [style, override] : style} />;
});
