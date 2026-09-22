import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ClubsScreen } from '../screens/ClubsScreen';
import { ExploreRoutesScreen } from '../screens/ExploreRoutesScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Ícones do mesmo estilo (traço fino, sem preenchimento) usado na navbar do
// site (includes/nav.php) — trocado do emoji anterior pra ficar consistente
// com o site e menos "gerado por IA". Preenchido quando a aba está ativa.
const ICONS_OUTLINE: Record<keyof MainTabParamList, IconName> = {
  Dashboard: 'home-outline',
  Friends: 'people-outline',
  Clubs: 'trophy-outline',
  Explore: 'map-outline',
  History: 'time-outline',
  Profile: 'person-circle-outline',
};

const ICONS_FILLED: Record<keyof MainTabParamList, IconName> = {
  Dashboard: 'home',
  Friends: 'people',
  Clubs: 'trophy',
  Explore: 'map',
  History: 'time',
  Profile: 'person-circle',
};

const LABELS: Record<keyof MainTabParamList, string> = {
  Dashboard: 'Início',
  Friends: 'Amigos',
  Clubs: 'Clubes',
  Explore: 'Explorar',
  History: 'Histórico',
  Profile: 'Perfil',
};

export function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabel: LABELS[route.name as keyof MainTabParamList],
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const name = route.name as keyof MainTabParamList;
          return <Ionicons name={focused ? ICONS_FILLED[name] : ICONS_OUTLINE[name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Clubs" component={ClubsScreen} />
      <Tab.Screen name="Explore" component={ExploreRoutesScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
