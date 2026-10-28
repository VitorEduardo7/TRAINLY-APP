import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { sportColor } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useFollowing, useFriendsOverview } from '../hooks/useSocial';
import { usePostsFeed } from '../hooks/usePosts';
import { Card } from '../components/Card';
import { TrainlyButton } from '../components/TrainlyButton';
import { Avatar } from '../components/Avatar';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionTitle } from '../components/SectionTitle';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { PostCard } from '../components/PostCard';
import { CreatePostModal } from '../components/CreatePostModal';
import { SportGlyph } from '../components/SportIcon';
import { FadeIn, PressableScale } from '../components/Motion';
import { SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView';
import { Text, TextInput } from '../components/Typography';
import { tapLight } from '../lib/haptics';
import { formatKm } from '../lib/geo';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'feed' | 'athletes';

/**
 * Aba Amigos — igual à parte social do site:
 *
 * - **Publicações**: o feed de amigos é feito de PUBLICAÇÕES (texto e/ou
 *   foto), com curtir e comentar só entre amigos. Treinos (atividades) não
 *   aparecem aqui e não recebem reação — cada um vê os próprios no
 *   Histórico, e os de um amigo no perfil dele. Em cima, quem treinou hoje.
 * - **Atletas**: busca por nome, atletas sugeridos e o ranking da semana.
 */
export function FriendsScreen() {
  const { colors, colorBlindMode } = useTheme();
  const { profile } = useAuth();
  const navigation = useNavigation<Nav>();
  const { followingIds, results, searching, search, follow, unfollow, reload: reloadFollowing } = useFollowing(profile?.id);
  const feed = usePostsFeed(profile?.id, followingIds);
  const overview = useFriendsOverview(profile?.id, followingIds);
  const [tab, setTab] = useState<Tab>('feed');
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const openProfile = useCallback(
    (userId: string, name?: string) => navigation.navigate('UserProfile', { userId, name }),
    [navigation],
  );

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const { reload: reloadFeed } = feed;
  const { reload: reloadOverview } = overview;
  useFocusEffect(
    useCallback(() => {
      reloadFollowing();
      reloadFeed();
      reloadOverview();
    }, [reloadFollowing, reloadFeed, reloadOverview]),
  );

  const toggleFollow = async (id: string, isFollowing: boolean) => {
    setBusyId(id);
    try {
      if (isFollowing) await unfollow(id);
      else {
        await follow(id);
        overview.dropSuggestion(id);
      }
    } catch (err: any) {
      Alert.alert('Trainly', err?.message ?? 'Não foi possível concluir. Tente de novo.');
    } finally {
      setBusyId(null);
    }
  };

  const refresh = () => {
    reloadFollowing();
    reloadFeed();
    reloadOverview();
  };

  const firstLoad = feed.loading && feed.posts.length === 0 && !feed.error;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={feed.loading && !firstLoad} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <ScreenHeader wash="friends" title="Amigos" />

        <SegmentedTabs
          options={[
            { value: 'feed', label: 'Publicações' },
            { value: 'athletes', label: 'Atletas' },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 18 }}
        />

        {tab === 'feed' ? (
          <>
            {/* "No que você está pensando?" — igual ao topo do feed do site. */}
            <PressableScale
              onPress={() => {
                tapLight();
                setComposerOpen(true);
              }}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel="Criar uma publicação"
            >
              <Card style={styles.composer}>
                <Avatar name={profile?.name ?? '?'} size={38} uri={profile?.avatar_url} />
                <Text style={[styles.composerText, { color: colors.textMuted }]} numberOfLines={1}>
                  No que você está pensando?
                </Text>
                <View style={[styles.composerIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="add" size={20} color="#fff" />
                </View>
              </Card>
            </PressableScale>

            {overview.activeToday.length > 0 && (
              <View style={{ marginTop: 22 }}>
                <SectionTitle title="Treinaram hoje" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeRow}>
                  {overview.activeToday.map((a) => {
                    const tint = sportColor(a.type, colorBlindMode);
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() => openProfile(a.id, a.name)}
                        style={({ pressed }) => [styles.activeItem, pressed && { opacity: 0.6 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`${a.name}: ${a.type}, ${formatKm(a.distanceKm)} km hoje`}
                      >
                        <Avatar name={a.name} size={52} uri={a.avatarUrl} ringColor={tint} />
                        <Text style={[styles.activeName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {a.name.split(' ')[0]}
                        </Text>
                        <View style={styles.activeMeta}>
                          <SportGlyph type={a.type} size={12} color={tint} />
                          <Text style={[styles.activeKm, { color: colors.textMuted }]}>{formatKm(a.distanceKm)} km</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={{ marginTop: 22 }}>
              <SectionTitle title="Publicações dos amigos" />
            </View>

            {firstLoad && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {!feed.loading && feed.posts.length === 0 && (
              <EmptyState
                icon={feed.error ? 'cloud-offline-outline' : 'chatbubbles-outline'}
                title={
                  feed.missingTable
                    ? 'Publicações ainda não ativadas'
                    : feed.error
                      ? 'Não foi possível carregar'
                      : followingIds.size === 0
                        ? 'Seu feed está vazio'
                        : 'Nenhuma publicação ainda'
                }
                message={
                  feed.missingTable
                    ? 'O banco ainda não tem a tabela de publicações. Rode o arquivo supabase/site_integration.sql no Supabase.'
                    : feed.error
                      ? 'Puxe a tela pra baixo pra tentar de novo.'
                      : followingIds.size === 0
                        ? 'Siga alguns atletas na aba "Atletas" pra ver as publicações deles aqui.'
                        : 'Seja o primeiro: toque em "No que você está pensando?" e publique algo.'
                }
                action={
                  !feed.error && followingIds.size === 0 ? (
                    <TrainlyButton title="Encontrar atletas" variant="secondary" icon="search" onPress={() => setTab('athletes')} />
                  ) : undefined
                }
              />
            )}

            {feed.posts.map((post, i) => (
              <FadeIn key={post.id} delay={Math.min(i, 4) * 60}>
                <PostCard
                  post={post}
                  viewerId={profile?.id}
                  onToggleLike={feed.toggleLike}
                  onAddComment={feed.addComment}
                  onDeleteComment={feed.deleteComment}
                  onDelete={feed.deletePost}
                  onOpenProfile={openProfile}
                />
              </FadeIn>
            ))}
          </>
        ) : (
          <>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.card, borderColor: searchFocused ? colors.primary : colors.border },
              ]}
            >
              <Ionicons name="search" size={18} color={searchFocused ? colors.primary : colors.textMuted} />
              <TextInput
                placeholder="Buscar atletas pelo nome..."
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                returnKeyType="search"
                autoCorrect={false}
                style={[styles.searchInput, { color: colors.textPrimary }]}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Limpar busca">
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {query.trim().length > 0 ? (
              <View>
                {searching && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}
                {!searching && results.length === 0 && (
                  <EmptyState compact icon="person-outline" title="Ninguém encontrado" message="Confira o nome e tente de novo." />
                )}
                {results.map((person, i) => (
                  <FadeIn key={person.id} delay={Math.min(i, 5) * 40} offset={8}>
                    <PersonRow
                      name={person.name}
                      avatarUrl={person.avatar_url}
                      isFollowing={person.isFollowing}
                      busy={busyId === person.id}
                      onOpen={() => openProfile(person.id, person.name)}
                      onToggleFollow={() => toggleFollow(person.id, person.isFollowing)}
                    />
                  </FadeIn>
                ))}
              </View>
            ) : (
              <>
                <SectionTitle title="Atletas sugeridos" />
                {overview.loading && overview.suggested.length === 0 ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                ) : overview.suggested.length === 0 ? (
                  <EmptyState compact icon="people-outline" title="Você já segue todo mundo" message="Busque pelo nome pra achar mais gente." />
                ) : (
                  overview.suggested.map((p, i) => (
                    <FadeIn key={p.id} delay={Math.min(i, 5) * 40} offset={8}>
                      <PersonRow
                        name={p.name}
                        avatarUrl={p.avatarUrl}
                        detail={[
                          `${formatKm(p.kmMonth)} km no mês`,
                          p.mutualCount > 0 ? `${p.mutualCount} em comum` : p.location,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        isFollowing={followingIds.has(p.id)}
                        busy={busyId === p.id}
                        onOpen={() => openProfile(p.id, p.name)}
                        onToggleFollow={() => toggleFollow(p.id, followingIds.has(p.id))}
                      />
                    </FadeIn>
                  ))
                )}

                <View style={{ marginTop: 22 }}>
                  <SectionTitle title="Ranking da semana" />
                </View>
                <Card style={{ paddingVertical: 6 }}>
                  {overview.ranking.length <= 1 ? (
                    <Text style={[styles.rankEmpty, { color: colors.textMuted }]}>
                      Siga outros atletas pra disputar o ranking de km da semana.
                    </Text>
                  ) : (
                    overview.ranking.map((r, i) => (
                      <Pressable
                        key={r.id}
                        onPress={() => !r.isMe && openProfile(r.id, r.name)}
                        style={[styles.rankRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                      >
                        <Text style={[styles.rankPos, { color: i === 0 ? colors.goldText : colors.textMuted }]}>{i + 1}</Text>
                        <Avatar name={r.name} size={34} uri={r.avatarUrl} />
                        <Text
                          style={[styles.rankName, { color: colors.textPrimary }, r.isMe && { color: colors.primary }]}
                          numberOfLines={1}
                        >
                          {r.isMe ? 'Você' : r.name}
                        </Text>
                        <Text style={[styles.rankKm, { color: colors.textPrimary }]}>{formatKm(r.weekKm)} km</Text>
                      </Pressable>
                    ))
                  )}
                </Card>
              </>
            )}
          </>
        )}
      </KeyboardAwareScrollView>

      <CreatePostModal visible={composerOpen} onClose={() => setComposerOpen(false)} onPublish={feed.createPost} />
    </SafeAreaView>
  );
}

function PersonRow({
  name,
  avatarUrl,
  detail,
  isFollowing,
  busy,
  onOpen,
  onToggleFollow,
}: {
  name: string;
  avatarUrl: string | null;
  detail?: string;
  isFollowing: boolean;
  busy: boolean;
  onOpen: () => void;
  onToggleFollow: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.personCard}>
      {/* Toque no avatar/nome abre o perfil; o botão de seguir fica fora do
          Pressable pra os dois toques não se atrapalharem. */}
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.personTap, pressed && { opacity: 0.6 }]}>
        <Avatar name={name} size={42} uri={avatarUrl} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.personName, { color: colors.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
          {detail ? (
            <Text style={[styles.personDetail, { color: colors.textMuted }]} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <TrainlyButton
        size="sm"
        title={isFollowing ? 'Seguindo' : 'Seguir'}
        icon={isFollowing ? 'checkmark' : 'person-add-outline'}
        variant={isFollowing ? 'secondary' : 'primary'}
        onPress={onToggleFollow}
        loading={busy}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 130 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  composerText: { flex: 1, fontSize: 14.5, fontWeight: '500' },
  composerIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  activeRow: { gap: 14, paddingRight: 8 },
  activeItem: { alignItems: 'center', width: 66 },
  activeName: { fontSize: 12.5, fontWeight: '600', marginTop: 6 },
  activeMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  activeKm: { fontSize: 11, fontWeight: '500' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 18,
    minHeight: 50,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  personCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, paddingVertical: 12 },
  personTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personName: { fontSize: 14.5, fontWeight: '700' },
  personDetail: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  rankEmpty: { fontSize: 13, fontWeight: '500', paddingVertical: 12, textAlign: 'center' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rankPos: { width: 22, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  rankName: { flex: 1, fontSize: 14, fontWeight: '600' },
  rankKm: { fontSize: 16, fontWeight: '800' },
});
