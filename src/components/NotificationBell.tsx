import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useNotifications } from '../hooks/useNotifications';
import { RootStackParamList } from '../navigation/types';
import { PressableScale } from './Motion';
import { Text } from './Typography';
import { tapLight } from '../lib/haptics';

/**
 * Sino de notificações: círculo de contorno fino. Fica dourado quando tem
 * novidade, com a contagem num selo vermelho no canto. Usado no cabeçalho
 * das abas e no topo do Início.
 */
export function NotificationBell({ size = 42 }: { size?: number }) {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { unreadCount } = useNotifications();
  const hasUnread = unreadCount > 0;

  return (
    <PressableScale
      onPress={() => {
        tapLight();
        navigation.navigate('Notifications');
      }}
      hitSlop={8}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel="Notificações"
      accessibilityHint={hasUnread ? `${unreadCount} novas` : undefined}
      style={[
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'transparent',
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons
        name={hasUnread ? 'notifications' : 'notifications-outline'}
        size={Math.round(size * 0.46)}
        color={hasUnread ? colors.gold : colors.textPrimary}
      />
      {hasUnread && (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.background }]}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
