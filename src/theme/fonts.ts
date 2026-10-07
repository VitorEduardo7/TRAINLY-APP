import { createContext, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';

/**
 * Duas famílias, com papéis bem separados (identidade "Noturno"):
 *
 * - **Inter** (a mesma do site, css/global.css) pro texto: legendas,
 *   descrições, rótulos, campos — pesos 400 a 700.
 * - **Barlow Condensed** pra tudo que é "placar": títulos, números grandes e
 *   botões — pesos 800 e 900. É a letra de número de peito, de camisa e de
 *   placar de estádio: estreita, firme, lê de longe. Em itálico
 *   (`fontStyle: 'italic'`) vira o número "em movimento" dos destaques.
 *
 * A Barlow vem DENTRO do projeto (assets/fonts, licença OFL junto), não por
 * pacote do npm — assim não precisa de `npm install` extra em nenhum PC.
 *
 * Quem escolhe a família é o peso (e o estilo) pedido no estilo do texto —
 * ver `fontFamilyFor` — então nenhuma tela precisa saber qual fonte usar.
 */
export const APP_FONTS = {
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  BarlowCondensed_700Bold: require('../../assets/fonts/BarlowCondensed_700Bold.ttf'),
  BarlowCondensed_800ExtraBold: require('../../assets/fonts/BarlowCondensed_800ExtraBold.ttf'),
  BarlowCondensed_700Bold_Italic: require('../../assets/fonts/BarlowCondensed_700Bold_Italic.ttf'),
  BarlowCondensed_800ExtraBold_Italic: require('../../assets/fonts/BarlowCondensed_800ExtraBold_Italic.ttf'),
  // A fonte dos ícones entra junto: carregada antes da primeira tela, os
  // ícones da barra de abas não aparecem "em branco" por um instante.
  ...Ionicons.font,
};

export type AppFontFamily =
  | 'Inter_400Regular'
  | 'Inter_500Medium'
  | 'Inter_600SemiBold'
  | 'Inter_700Bold'
  | 'BarlowCondensed_700Bold'
  | 'BarlowCondensed_800ExtraBold'
  | 'BarlowCondensed_700Bold_Italic'
  | 'BarlowCondensed_800ExtraBold_Italic';

const FAMILY_BY_WEIGHT: Record<string, AppFontFamily> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'BarlowCondensed_700Bold',
  '900': 'BarlowCondensed_800ExtraBold',
};

const ITALIC_BY_FAMILY: Partial<Record<AppFontFamily, AppFontFamily>> = {
  BarlowCondensed_700Bold: 'BarlowCondensed_700Bold_Italic',
  BarlowCondensed_800ExtraBold: 'BarlowCondensed_800ExtraBold_Italic',
};

/**
 * Com fonte customizada, cada peso é um ARQUIVO diferente — `fontWeight`
 * sozinho não troca de arquivo (no Android ainda gera um "negrito falso").
 * Então o peso (e o itálico) pedido no estilo vira o nome da família certa.
 * Itálico só existe na Barlow: em texto Inter ele é ignorado de propósito.
 */
export function fontFamilyFor(
  weight: string | number | null | undefined,
  style?: string | null,
): AppFontFamily {
  const family = FAMILY_BY_WEIGHT[String(weight ?? '400')] ?? 'Inter_400Regular';
  if (style === 'italic') return ITALIC_BY_FAMILY[family] ?? family;
  return family;
}

/** Nome antigo, mantido pra não quebrar quem ainda importa assim. */
export const interFamily = fontFamilyFor;

/**
 * `true` só depois que as fontes carregaram de verdade. Antes disso (ou se o
 * carregamento falhar), o texto usa a fonte do sistema — nunca uma fonte que
 * ainda não existe, o que gera aviso no Expo e texto invisível em alguns
 * aparelhos.
 */
export const FontsReadyContext = createContext(false);

export function useFontsReady(): boolean {
  return useContext(FontsReadyContext);
}
