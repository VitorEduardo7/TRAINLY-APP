import React, { useCallback, useRef, useState } from 'react';
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
import { timeAgo } from '../lib/time';
import { useNotifications, TrainlyNotification } from '../hooks/useNotifications';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function textFor(n: TrainlyNotification): string {
  const who = n.actorName;
  switch (n.kind) {
    case 'follow':
      return `${who} começou a seguir você.`;
    case 'like':
      return `${who} curtiu sua atividade${n.activityTitle ? ` "${n.activityTitle}"` : ''}.`;
    case 'comment':
      return `${who} comentou na sua atividade${n.activityTitle ? ` "${n.activityTitle}"` : ''}.`;
    case 'post_like':
      return `${who} curtiu sua publicação.`;
    case 'post_comment':
      return `${who} comentou na sua publicação.`;
    case 'new_post':
      return n.count > 1 ? `${who} fez ${n.count} novas publicações.` : `${who} fez uma nova publicação.`;
    case 'club_join':
      return `${who} entrou no seu clube${n.clubName ? ` ${n.clubName}` : ''}.`;
    case 'new_challenge':
      return `${who} criou o desafio "${n.challengeTitle ?? ''}"${n.clubName ? ` no clube ${n.clubName}` : ''}.`;
    default:
      return `${who} interagiu com você.`;
  }
}

function iconFor(n: TrainlyNotification): IconName {
  switch (n.kind) {
    case 'follow':
      return 'person-add';
    case 'like':
    case 'post_like':
      return 'heart';
    case 'comment':
    case 'post_comment':
      return 'chatbubble';
    case 'new_post':
      return 'create';
    case 'club_join':
      return 'people';
    case 'new_challenge':
      return 'trophy';
    default:
      return 'notifications';
  }
}

/** Cor do selinho do ícone — uma por tipo, pra diferenciar de relance sem ler o texto. */
function colorFor(n: TrainlyNotification, colors: { primary: string; danger: string; success: string; gold: string }): string {
  if (n.kind === 'follow' || n.kind === 'club_join') return colors.primary;
  if (n.kind === 'like' || n.kind === 'post_like') return colors.danger;
  if (n.kind === 'new_challenge') return colors.gold;
  return colors.success;
}

export function NotificationsScreen() {
  const { colors } = useTheme();
  const { items, loading, reload, markAllRead } = useNotifications();
  const navigation = useNavigation<Nav>();
  // Quais estavam NÃO lidas quando a tela abriu: continuam destacadas
  // enquanto você está aqui, mesmo já marcadas como lidas no banco.
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Recarrega toda vez que a tela ganha foco, e marca tudo como lido — é o
  // que zera o número no sininho (do app e do site) ao visitar a tela.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      reload().then(() => {
        if (!active) return;
        setFresh(new Set(itemsRef.current.filter((n) => !n.read).map((n) => n.id)));
        markAllRead();
      });
      return () => {
        active = false;
      };
    }, [reload, markAllRead]),
  );

  const openItem = (item: TrainlyNotification) => {
    tapLight();
    // Publicações (as suas e as dos amigos) ficam no feed da aba Amigos.
    if (item.kind === 'new_post' || item.kind === 'post_like' || item.kind === 'post_comment') {
      navigation.navigate('Main', { screen: 'Friends' });
      return;
    }
    if ((item.kind === 'new_challenge' || item.kind === 'club_join') && item.clubId) {
      navigation.navigate('ClubDetail', { clubId: item.clubId });
      return;
    }
    navigation.navigate('UserProfile', { userId: item.actorId, name: item.actorName });
  };

  const renderItem = ({ item, index }: { item: TrainlyNotification; index: number }) => (
    <FadeIn delay={Math.min(index, 6) * 40} offset={8}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => openItem(item)}
        style={[
          styles.row,
          { backgroundColor: colors.card, borderColor: fresh.has(item.id) ? colors.primary : colors.border },
        ]}
      >
        <View>
          <Avatar name={item.actorName} size={42} uri={item.actorAvatarUrl} />
          <View style={[styles.iconBadge, { backgroundColor: colorFor(item, colors), borderColor: colors.card }]}>
            <Ionicons name={iconFor(item)} size={10} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.text, { color: colors.textPrimary }]}>{textFor(item)}</Text>
          <Text style={[styles.time, { color: fresh.has(item.id) ? colors.primary : colors.textMuted }]}>
            {fresh.has(item.id) ? 'Nova · ' : ''}
            {timeAgo(item.createdAt)}
          </Text>
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
              message="Novos seguidores, curtidas e comentários nas suas publicações e novidades dos seus clubes aparecem aqui."
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
