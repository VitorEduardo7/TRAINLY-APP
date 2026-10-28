import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

/**
 * Referência ao navegador principal — pra componentes que ficam por cima de
 * tudo (ex: o aviso de conquista nova) conseguirem abrir uma tela.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
