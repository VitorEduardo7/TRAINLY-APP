import { createContext, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';

/**
 * Fonte Inter — a mesma do site (css/global.css). Só os pesos que o app usa,
 * importados arquivo por arquivo (em vez do índice do pacote, que registraria
 * todos os 18 pesos, inclusive itálicos, no build).
 */
export const APP_FONTS = {
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  Inter_800ExtraBold: require('@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf'),
  // A fonte dos ícones entra junto: carregada antes da primeira tela, os
  // ícones da barra de abas não aparecem "em branco" por um instante.
  ...Ionicons.font,
};

type InterFamily =
  | 'Inter_400Regular'
  | 'Inter_500Medium'
  | 'Inter_600SemiBold'
  | 'Inter_700Bold'
  | 'Inter_800ExtraBold';

const FAMILY_BY_WEIGHT: Record<string, InterFamily> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  // 900 usa o ExtraBold: o Black da Inter fica pesado demais em título de tela.
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_800ExtraBold',
};

/**
 * Com fonte customizada, cada peso é um ARQUIVO diferente — `fontWeight`
 * sozinho não troca de arquivo (no Android ainda gera um "negrito falso").
 * Então o peso pedido no estilo vira o nome da família certa.
 */
export function interFamily(weight: string | number | null | undefined): InterFamily {
  return FAMILY_BY_WEIGHT[String(weight ?? '400')] ?? 'Inter_400Regular';
}

/**
 * `true` só depois que a Inter carregou de verdade. Antes disso (ou se o
 * carregamento falhar), o texto usa a fonte do sistema — nunca uma fonte que
 * ainda não existe, o que gera aviso no Expo e texto invisível em alguns
 * aparelhos.
 */
export const FontsReadyContext = createContext(false);

export function useFontsReady(): boolean {
  return useContext(FontsReadyContext);
}
