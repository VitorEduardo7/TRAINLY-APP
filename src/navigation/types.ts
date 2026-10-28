import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Auth: undefined;
  /** As abas. Dá pra abrir direto numa aba: navigate('Main', { screen: 'Friends' }). */
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Run: undefined;
  ClubDetail: { clubId: string };
  RouteDetail: { routeId: string };
  /** Perfil público de outro atleta. `name` é só pra preencher o cabeçalho
   *  antes do perfil terminar de carregar. */
  UserProfile: { userId: string; name?: string };
  Notifications: undefined;
  /** Grade de conquistas — da própria pessoa ou de outra (`name` só ajusta o título). */
  Achievements: { userId: string; name?: string };
  /** Escolher moldura de avatar e cor do mapa — sempre a própria pessoa. */
  Customization: undefined;
  /** Ranking geral da Guerra de Clã (todos os clubes, fim de semana atual). */
  ClanWar: undefined;
  /** Detalhe da sequência semanal — calendário seg-dom + atividades da
   *  semana. Da própria pessoa ou de outra (`name` só ajusta o título). */
  Streak: { userId: string; name?: string };
  /** Configurações gerais: conta (e-mail/senha), acessibilidade, sessão. */
  Settings: undefined;
  /** Gráficos de evolução (km por mês, ritmo médio) — sempre a própria pessoa. */
  Evolution: undefined;
  /** Introdução do primeiro acesso (XP, patentes, social e meta do mês). */
  Onboarding: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Friends: undefined;
  Clubs: undefined;
  Explore: undefined;
  History: undefined;
  Profile: undefined;
};
