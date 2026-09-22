import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { NotificationsProvider } from '../hooks/useNotifications';
import { LoginScreen } from '../screens/LoginScreen';
import { RunScreen } from '../screens/RunScreen';
import { ClubDetailScreen } from '../screens/ClubDetailScreen';
import { RouteDetailScreen } from '../screens/RouteDetailScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { MainTabs } from './MainTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { colors, mode } = useTheme();
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NotificationsProvider userId={profile?.id}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="Run" component={RunScreen} options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="ClubDetail" component={ClubDetailScreen} options={{ headerShown: true, title: 'Clube' }} />
              <Stack.Screen name="RouteDetail" component={RouteDetailScreen} options={{ headerShown: true, title: 'Rota' }} />
              <Stack.Screen
                name="UserProfile"
                component={UserProfileScreen}
                options={{ headerShown: true, title: 'Perfil', headerBackTitle: 'Voltar' }}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ headerShown: true, title: 'Notificações', headerBackTitle: 'Voltar' }}
              />
            </>
          ) : (
            <Stack.Screen name="Auth" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </NotificationsProvider>
  );
}
