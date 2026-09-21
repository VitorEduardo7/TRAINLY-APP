import React from 'react';
import { Text } from 'react-native';
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

const ICONS: Record<keyof MainTabParamList, string> = {
  Dashboard: '🏠',
  Friends: '👥',
  Clubs: '🏆',
  Explore: '🗺️',
  History: '📋',
  Profile: '👤',
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
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 16, color }}>{ICONS[route.name as keyof MainTabParamList]}</Text>
        ),
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
