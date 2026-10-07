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
import { fontFamilyFor, useFontsReady } from '../theme/fonts';
import { FONT_SCALE_MULTIPLIER, useTheme } from '../theme/ThemeContext';

/**
 * `Text` e `TextInput` do app: iguais aos do React Native, só que aplicam a
 * fonte certa pro peso pedido (Inter no texto, Barlow Condensed nos títulos e
 * números — ver `fontFamilyFor`) e o tamanho de texto das
 * opções de acessibilidade (Configurações → Acessibilidade). Todas as telas
 * importam daqui em vez de 'react-native', então tipografia e escala de
 * texto ficam consistentes sem precisar lembrar disso em cada estilo.
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
  // `fontWeight: 'normal'` (e `fontStyle: 'normal'` no itálico) junto: o
  // arquivo escolhido já É o peso/estilo certo; sem isso o Android aplicaria
  // um negrito/itálico sintético por cima.
  let family = fontFamilyFor(flat.fontWeight, flat.fontStyle);
  // A Barlow Condensed é letra de DISPLAY: estreita, lê mal em tamanho
  // pequeno. Rótulos pesados abaixo de 16px (ou sem tamanho, como trechos
  // destacados dentro de uma frase) ficam na Inter Bold — só título, número
  // grande e botão viram Barlow.
  if (family.startsWith('BarlowCondensed') && (typeof flat.fontSize !== 'number' || flat.fontSize < 16)) {
    family = 'Inter_700Bold';
  }
  return family.endsWith('_Italic')
    ? { fontFamily: family, fontWeight: 'normal', fontStyle: 'normal' }
    : { fontFamily: family, fontWeight: 'normal' };
}

/** Multiplica o `fontSize` do estilo pela escala escolhida em Acessibilidade — só quando o estilo já define um tamanho explícito, pra não mexer em texto que usa o padrão do sistema. */
function scaleOverride(style: StyleProp<TextStyle>, scale: number): TextStyle | null {
  if (scale === 1) return null;
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (typeof flat.fontSize !== 'number') return null;
  return { fontSize: flat.fontSize * scale };
}

function combinedOverride(
  style: StyleProp<TextStyle>,
  nested: boolean,
  ready: boolean,
  scale: number,
): TextStyle | null {
  const family = fontOverride(style, nested, ready);
  const size = scaleOverride(style, scale);
  if (!family && !size) return null;
  return { ...family, ...size };
}

export function Text({ style, children, ...rest }: TextProps) {
  const ready = useFontsReady();
  const nested = useContext(InsideText);
  const { fontScale } = useTheme();
  const override = combinedOverride(style, nested, ready, FONT_SCALE_MULTIPLIER[fontScale]);
  return (
    <RNText {...rest} style={override ? [style, override] : style}>
      <InsideText.Provider value={true}>{children}</InsideText.Provider>
    </RNText>
  );
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  const ready = useFontsReady();
  const { fontScale } = useTheme();
  const override = combinedOverride(style, false, ready, FONT_SCALE_MULTIPLIER[fontScale]);
  return <RNTextInput ref={ref} {...rest} style={override ? [style, override] : style} />;
});
