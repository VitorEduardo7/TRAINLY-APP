import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Avatar } from '../components/Avatar';
import { useNotifications, TrainlyNotification } from '../hooks/useNotifications';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function textFor(n: TrainlyNotification): string {
  if (n.kind === 'follow') return `${n.actorName} começou a seguir você.`;
  if (n.kind === 'like') return `${n.actorName} curtiu sua atividade${n.activityTitle ? ` "${n.activityTitle}"` : ''}.`;
  return `${n.actorName} comentou na sua atividade${n.activityTitle ? ` "${n.activityTitle}"` : ''}.`;
}

function iconFor(n: TrainlyNotification): IconName {
  if (n.kind === 'follow') return 'person-add';
  if (n.kind === 'like') return 'heart';
  return 'chatbubble';
}

export function NotificationsScreen() {
  const { colors } = useTheme();
  const { items, loading, reload, markAllRead } = useNotifications();
  const navigation = useNavigation<Nav>();

  // Recarrega toda vez que a tela ganha foco, e marca tudo como lido — é o
  // que zera o número no sininho ao visitar a tela.
  useFocusEffect(
    useCallback(() => {
      reload();
      markAllRead();
    }, [reload, markAllRead]),
  );

  const renderItem = ({ item }: { item: TrainlyNotification }) => (
    <Pressable
      style={[styles.row, { borderColor: colors.border }]}
      onPress={() => navigation.navigate('UserProfile', { userId: item.actorId, name: item.actorName })}
    >
      <View>
        <Avatar name={item.actorName} size={42} />
        <View style={[styles.iconBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          <Ionicons name={iconFor(item)} size={10} color="#fff" />
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[styles.text, { color: colors.textPrimary }]}>{textFor(item)}</Text>
        <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(item.createdAt)}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onRefresh={reload}
        refreshing={loading}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Nada por aqui ainda — curtidas, comentários e novos seguidores aparecem nesta tela.
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 8, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  iconBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  text: { fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  time: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 13.5, lineHeight: 19, paddingHorizontal: 30 },
});
