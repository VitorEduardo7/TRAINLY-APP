import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useActivities } from '../hooks/useActivities';
import { useStreak } from '../hooks/useStreak';
import { supabase } from '../lib/supabase';
import { Card } from '../components/Card';
import { Avatar, avatarFrameSize } from '../components/Avatar';
import { RankWidget } from '../components/RankWidget';
import { RankTrail } from '../components/RankTrail';
import { TrainlyButton } from '../components/TrainlyButton';
import { EditProfileModal, ProfileEditFields } from '../components/EditProfileModal';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { PostCard } from '../components/PostCard';
import { EmptyState } from '../components/EmptyState';
import { useUserPosts } from '../hooks/usePosts';
import { removeImageByUrl } from '../lib/photoUpload';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionTitle } from '../components/SectionTitle';
import { StatTile } from '../components/StatTile';
import { AchievementsPreviewCard } from '../components/AchievementsPreviewCard';
import { CustomizationPreviewCard } from '../components/CustomizationPreviewCard';
import { StreakBadge } from '../components/StreakBadge';
import { FadeIn } from '../components/Motion';
import { Text } from '../components/Typography';
import { effectiveTier } from '../lib/rank';
import { RootStackParamList } from '../navigation/types';
import { activityStats } from '../lib/stats';
import { formatClock, formatKm } from '../lib/geo';
import { levelInfo } from '../lib/rank';

// Fixo porque o cálculo do tamanho da moldura (`avatarFrameSize`) depende do
// `size` passado ao Avatar — precisa ser o mesmo valor nos dois lugares.
const AVATAR_SIZE = 88;
const AVATAR_FRAME_SIZE = avatarFrameSize(AVATAR_SIZE);

export function ProfileScreen() {
  const { colors } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const { activities, loading, reload } = useActivities(profile?.id);
  const { streak } = useStreak(profile?.id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [editVisible, setEditVisible] = useState(false);
  const [section, setSection] = useState<'perfil' | 'publicacoes'>('perfil');
  const posts = useUserPosts(profile?.id, profile?.id);

  // Sem isso, o Resumo/Recordes ficava com números velhos depois de registrar
  // uma atividade em outra aba e voltar pro Perfil sem reiniciar o app.
  useFocusEffect(
    useCallback(() => {
      reload();
      posts.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload, posts.reload]),
  );

  const stats = activityStats(activities);
  const rankInfo = levelInfo(profile?.xp ?? 0);
  const frameTier = effectiveTier(profile?.xp ?? 0, profile?.equipped_frame_tier);

  const handleSaveProfile = async (fields: ProfileEditFields) => {
    if (!profile) return;
    const update: Record<string, unknown> = {
      name: fields.name,
      location: fields.location || null,
      bio: fields.bio || null,
      avatar_url: fields.avatarUrl,
    };
    // Colunas que vêm do site (site_integration.sql) — só manda se o banco tem.
    if ('monthly_goal_type' in profile) {
      update.cover_url = fields.coverUrl;
      update.monthly_goal_type = fields.goalType;
      update.monthly_goal_value = fields.goalValue;
      if (fields.goalType === 'km') update.monthly_goal_km = Math.max(1, Math.round(fields.goalValue));
    } else {
      update.monthly_goal_km = Math.max(1, Math.round(fields.goalValue));
    }
    const { error } = await supabase.from('profiles').update(update).eq('id', profile.id);
    if (error) throw error;
    // Capa/foto trocadas: apaga o arquivo antigo do Storage (não atrapalha se falhar).
    if (profile.cover_url && profile.cover_url !== fields.coverUrl) removeImageByUrl('covers', profile.cover_url);
    await refreshProfile();
  };

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
      >
        <ScreenHeader wash="profile" title="Perfil" />

        <FadeIn style={styles.header}>
          {profile?.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={[styles.cover, { backgroundColor: colors.surface }]} resizeMode="cover" />
          ) : null}
          <View style={[{ width: AVATAR_FRAME_SIZE, height: AVATAR_FRAME_SIZE }, profile?.cover_url ? styles.avatarOnCover : null]}>
            <Avatar name={profile?.name ?? '?'} size={AVATAR_SIZE} uri={profile?.avatar_url} frameTier={frameTier.name} zoomable />
            {/* Do ladinho da moldura, não escondido embaixo do nome — é o
                primeiro emblema que a pessoa deveria notar no próprio perfil. */}
            <View style={styles.streakAnchor}>
              <StreakBadge streak={streak} userId={profile?.id} size="sm" />
            </View>
          </View>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{profile?.name}</Text>
          {profile?.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.location, { color: colors.textMuted }]}>{profile.location}</Text>
            </View>
          ) : null}
          {profile?.bio ? <Text style={[styles.bio, { color: colors.textMuted }]}>{profile.bio}</Text> : null}
        </FadeIn>

        <FadeIn delay={60} style={styles.rowButtons}>
          <View style={{ flex: 1 }}>
            <TrainlyButton title="Editar Perfil" variant="secondary" onPress={() => setEditVisible(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <TrainlyButton
              title="Configurações"
              variant="secondary"
              onPress={() => navigation.navigate('Settings')}
            />
          </View>
        </FadeIn>

        <SegmentedTabs
          options={[
            { value: 'perfil', label: 'Perfil' },
            { value: 'publicacoes', label: 'Minhas publicações' },
          ]}
          value={section}
          onChange={setSection}
          style={{ marginTop: 18 }}
        />

        {section === 'publicacoes' ? (
          <View style={{ marginTop: 16, marginBottom: 24 }}>
            {posts.loading && posts.posts.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : posts.posts.length === 0 ? (
              <EmptyState
                compact
                icon="chatbubbles-outline"
                title="Você ainda não publicou nada"
                message='Publique na aba Amigos, em "No que você está pensando?".'
              />
            ) : (
              posts.posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  viewerId={profile?.id}
                  onToggleLike={posts.toggleLike}
                  onAddComment={posts.addComment}
                  onDeleteComment={posts.deleteComment}
                  onDelete={posts.deletePost}
                  onOpenProfile={(userId, name) => {
                    if (userId !== profile?.id) navigation.navigate('UserProfile', { userId, name });
                  }}
                />
              ))
            )}
          </View>
        ) : (
        <>
        <FadeIn delay={90} style={{ marginTop: 16 }}>
          <AchievementsPreviewCard
            userId={profile?.id}
            onPress={() => {
              if (!profile) return;
              navigation.navigate('Achievements', { userId: profile.id, name: profile.name });
            }}
          />
        </FadeIn>

        <FadeIn delay={105} style={{ marginTop: 16 }}>
          <CustomizationPreviewCard profile={profile} onPress={() => navigation.navigate('Customization')} />
        </FadeIn>

        <FadeIn delay={120}>
          <Card style={{ marginTop: 16 }}>
            <RankWidget xp={profile?.xp ?? 0} />
          </Card>
        </FadeIn>

        <FadeIn delay={170}>
          <Card style={{ marginTop: 16 }}>
            <SectionTitle title="Patentes" />
            <RankTrail xp={profile?.xp ?? 0} />
          </Card>
        </FadeIn>

        <FadeIn delay={220}>
          <Card style={{ marginTop: 16 }}>
            <SectionTitle
              title="Resumo"
              right={
                <Text
                  onPress={() => navigation.navigate('Evolution')}
                  style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}
                  accessibilityRole="link"
                >
                  Ver evolução
                </Text>
              }
            />
            <View style={styles.grid}>
              <StatTile
                size="lg"
                gradient={colors.accentGradient}
                icon="star"
                label="XP Total"
                value={(profile?.xp ?? 0).toLocaleString('pt-BR')}
              />
              <StatTile icon="navigate" label="Distância Total" value={`${formatKm(stats.totalKm)} km`} />
              <StatTile icon="time" label="Tempo Ativo" value={formatClock(stats.totalSec)} />
              <StatTile icon="trending-up" label="Elevação Acum." value={`${stats.totalElev} m`} />
              <StatTile icon="flash" label="Atividades" value={String(stats.count)} />
              <StatTile icon="calendar-outline" label="Dias Ativos" value={`${stats.activeDays} dias`} />
            </View>
          </Card>
        </FadeIn>

        <FadeIn delay={270}>
          <Card style={{ marginTop: 16, marginBottom: 24 }}>
            <SectionTitle title="Recordes Pessoais" />
            <View style={styles.grid}>
              <StatTile icon="navigate" label="Maior Distância" value={`${formatKm(stats.bestDistanceKm)} km`} />
              <StatTile icon="time" label="Maior Duração" value={formatClock(stats.longestDurationSec)} />
            </View>
          </Card>
        </FadeIn>
        </>
        )}

        <EditProfileModal
          visible={editVisible}
          profile={profile}
          onClose={() => setEditVisible(false)}
          onSave={handleSaveProfile}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 130 },
  header: { alignItems: 'center', marginBottom: 20 },
  cover: { width: '100%', height: 140, borderRadius: 20 },
  avatarOnCover: { marginTop: -AVATAR_FRAME_SIZE / 2 },
  // Grudado fora da moldura (não por cima do anel) — mais pra direita ainda
  // do que a primeira tentativa, pra sair bem clara da borda.
  streakAnchor: { position: 'absolute', right: -22, bottom: -2 },
  name: { fontSize: 20, fontWeight: '900', marginTop: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  location: { fontSize: 13, fontWeight: '600' },
  bio: { fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  rowButtons: { flexDirection: 'row', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
