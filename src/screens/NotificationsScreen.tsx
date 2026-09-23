import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Avatar } from '../components/Avatar';
import { FadeIn, PressableScale } from '../components/Motion';
import { SkeletonRow } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Text } from '../components/Typography';
import { tapLight } from '../lib/haptics';
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

/** Cor do selinho do ícone — uma por tipo, pra dar de relance pra diferenciar
 * seguidor/curtida/comentário sem precisar ler o texto. */
function colorFor(n: TrainlyNotification, colors: { primary: string; danger: string; success: string }): string {
  if (n.kind === 'follow') return colors.primary;
  if (n.kind === 'like') return colors.danger;
  return colors.success;
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

  const renderItem = ({ item, index }: { item: TrainlyNotification; index: number }) => (
    <FadeIn delay={Math.min(index, 6) * 40} offset={8}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => {
          tapLight();
          navigation.navigate('UserProfile', { userId: item.actorId, name: item.actorName });
        }}
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View>
          <Avatar name={item.actorName} size={42} uri={item.actorAvatarUrl} />
          <View style={[styles.iconBadge, { backgroundColor: colorFor(item, colors), borderColor: colors.card }]}>
            <Ionicons name={iconFor(item)} size={10} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.text, { color: colors.textPrimary }]}>{textFor(item)}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(item.createdAt)}</Text>
        </View>
      </PressableScale>
    </FadeIn>
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
          loading ? (
            <View style={{ paddingTop: 8 }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <EmptyState
              icon="notifications-outline"
              title="Nada por aqui ainda"
              message="Curtidas, comentários e novos seguidores aparecem nesta tela."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
  },
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
});
