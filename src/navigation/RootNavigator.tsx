import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useFontsReady } from '../theme/fonts';
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
  const fontsReady = useFontsReady();
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseTheme,
    // Títulos dos cabeçalhos na mesma fonte do resto do app (quando carregada).
    fonts: fontsReady
      ? {
          regular: { fontFamily: 'Inter_400Regular', fontWeight: 'normal' as const },
          medium: { fontFamily: 'Inter_500Medium', fontWeight: 'normal' as const },
          bold: { fontFamily: 'Inter_700Bold', fontWeight: 'normal' as const },
          heavy: { fontFamily: 'Inter_800ExtraBold', fontWeight: 'normal' as const },
        }
      : baseTheme.fonts,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
    },
  };

  // Telas empilhadas (clube, rota, perfil, notificações): cabeçalho da cor do
  // fundo e sem a linha de separação — fica parecendo parte da tela, não uma
  // barra "colada" em cima.
  const detailHeader: NativeStackNavigationOptions = {
    headerShown: true,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.textPrimary },
    headerBackTitle: 'Voltar',
  };

  return (
    <NotificationsProvider userId={profile?.id}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="Run" component={RunScreen} options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="ClubDetail" component={ClubDetailScreen} options={{ ...detailHeader, title: 'Clube' }} />
              <Stack.Screen name="RouteDetail" component={RouteDetailScreen} options={{ ...detailHeader, title: 'Rota' }} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ ...detailHeader, title: 'Perfil' }} />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ ...detailHeader, title: 'Notificações' }}
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
