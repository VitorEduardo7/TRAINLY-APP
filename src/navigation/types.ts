export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
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
};

export type MainTabParamList = {
  Dashboard: undefined;
  Friends: undefined;
  Clubs: undefined;
  Explore: undefined;
  History: undefined;
  Profile: undefined;
};
