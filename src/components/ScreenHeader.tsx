import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useNotifications } from '../hooks/useNotifications';
import { RootStackParamList } from '../navigation/types';

interface Props {
  title: string;
  /** Ação extra à esquerda do sino — ex: o botão "+ Criar" em Clubes. */
  right?: React.ReactNode;
}

/**
 * Cabeçalho reaproveitado em toda tela principal (aba): título + sino de
 * notificações sempre visível, igual à navbar do site (includes/nav.php).
 */
export function ScreenHeader({ title, right }: Props) {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { unreadCount } = useNotifications();

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <View style={styles.actions}>
        {right}
        <Pressable
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={10}
          style={[styles.bellBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="notifications-outline" size={19} color={colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.background }]}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 },
  title: { fontSize: 24, fontWeight: '900' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
