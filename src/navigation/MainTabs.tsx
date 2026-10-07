import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeContext';
import { fontFamilyFor, useFontsReady } from '../theme/fonts';
import { prefersReducedMotion } from '../components/Motion';
import { PressableScale } from '../components/Motion';
import { Text } from '../components/Typography';
import { selection, tapLight } from '../lib/haptics';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ClubsScreen } from '../screens/ClubsScreen';
import { ExploreRoutesScreen } from '../screens/ExploreRoutesScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = React.ComponentProps<typeof Ionicons>['name'];

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

/**
 * Barra de abas flutuante, suspensa sobre o conteúdo. A aba ativa ganha uma
 * marca azul inclinada em cima do ícone — como a faixa de uma raia de pista —
 * em vez de um fundo colorido; ícone e nome acendem pro branco.
 */
function TabButton({
  name,
  focused,
  onPress,
}: {
  name: keyof MainTabParamList;
  focused: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const fontsReady = useFontsReady();
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      active.setValue(focused ? 1 : 0);
      return;
    }
    Animated.timing(active, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [focused, active]);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityLabel={LABELS[name]}
      accessibilityState={{ selected: focused }}
      style={styles.tabBtn}
    >
      <View style={styles.iconWrap}>
        <Animated.View
          style={[
            styles.mark,
            {
              backgroundColor: colors.primary,
              opacity: active,
              transform: [{ skewX: '-24deg' }, { scaleX: active.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            },
          ]}
        />
        <Ionicons
          name={focused ? ICONS_FILLED[name] : ICONS_OUTLINE[name]}
          size={21}
          color={focused ? colors.textPrimary : colors.textMuted}
        />
      </View>
      <Text
        style={[
          styles.label,
          fontsReady && { fontFamily: fontFamilyFor('600'), fontWeight: 'normal' },
          { color: focused ? colors.textPrimary : colors.textMuted },
        ]}
        numberOfLines={1}
      >
        {LABELS[name]}
      </Text>
    </PressableScale>
  );
}

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.floatWrap, { paddingBottom: insets.bottom > 0 ? insets.bottom - 6 : 12 }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: mode === 'dark' ? '#000' : colors.shadow,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const name = route.name as keyof MainTabParamList;
          return (
            <TabButton
              key={route.key}
              name={name}
              focused={focused}
              onPress={() => {
                selection();
                tapLight();
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
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

const styles = StyleSheet.create({
  floatWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 16 },
  bar: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 6,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2, gap: 3 },
  iconWrap: { width: 46, height: 34, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 },
  mark: { position: 'absolute', top: 0, width: 18, height: 3, borderRadius: 1 },
  label: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
});
