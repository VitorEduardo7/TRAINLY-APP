import React, { useLayoutEffect } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { RankWidget } from '../components/RankWidget';
import { RankTrail } from '../components/RankTrail';
import { TrainlyButton } from '../components/TrainlyButton';
import { SectionTitle } from '../components/SectionTitle';
import { StatTile } from '../components/StatTile';
import { EmptyState } from '../components/EmptyState';
import { FadeIn } from '../components/Motion';
import { Text } from '../components/Typography';
import { activityStats } from '../lib/stats';
import { formatClock, formatKm } from '../lib/geo';
import { levelInfo } from '../lib/rank';
import { RootStackParamList } from '../navigation/types';

type UserProfileRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

export function UserProfileScreen() {
  const { colors } = useTheme();
  const { profile: me } = useAuth();
  const { params } = useRoute<UserProfileRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const {
    profile,
    activities,
    isFollowing,
    followsMe,
    followerCount,
    followingCount,
    loading,
    error,
    busy,
    reload,
    toggleFollow,
  } = useUserProfile(params.userId, me?.id);

  // Título do header: usa o nome que já veio na navegação enquanto carrega,
  // pra a tela não abrir com o cabeçalho vazio e "pular" depois.
  useLayoutEffect(() => {
    navigation.setOptions({ title: profile?.name ?? params.name ?? 'Perfil' });
  }, [navigation, profile?.name, params.name]);

  // Sem useFocusEffect aqui de propósito: essa tela é empilhada e nasce
  // sempre nova, e o próprio hook já carrega ao montar — recarregar no foco
  // só faria uma segunda requisição idêntica ao abrir. Pra atualizar à mão
  // tem o "puxar pra baixo".

  // Só troca a tela inteira por erro/spinner enquanto NÃO houver perfil
  // carregado. Se o perfil já está na tela e só o "puxar pra atualizar"
  // falhou (sinal ruim), mantém o conteúdo em vez de apagar tudo.
  if (!profile) {
    if (error) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Não foi possível carregar"
            message="Esse perfil pode ter sido removido, ou sua internet caiu no meio do caminho."
            action={<TrainlyButton title="Tentar de novo" variant="secondary" onPress={reload} />}
          />
        </View>
      );
    }
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const stats = activityStats(activities);
  const rankInfo = levelInfo(profile.xp ?? 0);
  const firstName = profile.name?.split(' ')[0] ?? 'Ele';
  const isMe = me?.id === profile.id;

  // Rótulo no estilo Instagram: quem já te segue vira "Seguir de volta".
  const followLabel = isFollowing ? 'Seguindo' : followsMe ? 'Seguir de volta' : 'Seguir';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
    >
      <FadeIn style={styles.header}>
        <Avatar name={profile.name} size={88} uri={profile.avatar_url} ringColor={rankInfo.rank.color} zoomable />
        <Text style={[styles.name, { color: colors.textPrimary }]}>{profile.name}</Text>

        {followsMe && !isMe ? (
          <View style={[styles.followsYouChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.followsYouText, { color: colors.textMuted }]}>segue você</Text>
          </View>
        ) : null}

        {profile.location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.location, { color: colors.textMuted }]}>{profile.location}</Text>
          </View>
        ) : null}
        {profile.bio ? <Text style={[styles.bio, { color: colors.textMuted }]}>{profile.bio}</Text> : null}
      </FadeIn>

      <FadeIn delay={60}>
        <Card style={styles.countsCard}>
          <Count label="Seguidores" value={followerCount} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Count label="Seguindo" value={followingCount} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Count label="Atividades" value={stats.count} colors={colors} />
        </Card>
      </FadeIn>

      {!isMe && (
        <FadeIn delay={100} style={{ marginTop: 16 }}>
          <TrainlyButton
            title={followLabel}
            variant={isFollowing ? 'secondary' : 'primary'}
            onPress={toggleFollow}
            loading={busy}
          />
        </FadeIn>
      )}

      <FadeIn delay={150}>
        <Card style={{ marginTop: 16 }}>
          <SectionTitle title="Patente Atual" />
          <RankWidget xp={profile.xp ?? 0} />
        </Card>
      </FadeIn>

      <FadeIn delay={200}>
        <Card style={{ marginTop: 16 }}>
          <SectionTitle title="Patentes" />
          <RankTrail xp={profile.xp ?? 0} subjectName={isMe ? undefined : firstName} />
        </Card>
      </FadeIn>

      <FadeIn delay={250}>
        <Card style={{ marginTop: 16 }}>
          <SectionTitle title="Resumo" />
          <View style={styles.grid}>
            <StatTile icon="navigate" label="Distância Total" value={`${formatKm(stats.totalKm)} km`} />
            <StatTile icon="time" label="Tempo Ativo" value={formatClock(stats.totalSec)} />
            <StatTile icon="trending-up" label="Elevação Acum." value={`${stats.totalElev} m`} />
            <StatTile icon="flash" label="Atividades" value={String(stats.count)} />
            <StatTile icon="calendar-outline" label="Dias Ativos" value={`${stats.activeDays} dias`} />
            <StatTile icon="star" label="XP Total" value={(profile.xp ?? 0).toLocaleString('pt-BR')} />
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={300}>
        <Card style={{ marginTop: 16, marginBottom: 8 }}>
          <SectionTitle title="Recordes Pessoais" />
          {stats.count === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {firstName} ainda não registrou nenhuma atividade.
            </Text>
          ) : (
            <View style={styles.grid}>
              <StatTile icon="navigate" label="Maior Distância" value={`${formatKm(stats.bestDistanceKm)} km`} />
              <StatTile icon="time" label="Maior Duração" value={formatClock(stats.longestDurationSec)} />
            </View>
          )}
        </Card>
      </FadeIn>
    </ScrollView>
  );
}

function Count({ label, value, colors }: { label: string; value: number; colors: any }) {
  return (
    <View style={styles.count}>
      <Text style={[styles.countValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.countLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 20, fontWeight: '900', marginTop: 12 },
  followsYouChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginTop: 8 },
  followsYouText: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  location: { fontSize: 13, fontWeight: '600' },
  bio: { fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },
  countsCard: { flexDirection: 'row', alignItems: 'center' },
  count: { flex: 1, alignItems: 'center' },
  countValue: { fontSize: 19, fontWeight: '900' },
  countLabel: { fontSize: 10.5, fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  divider: { width: 1, alignSelf: 'stretch', marginVertical: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empty: { fontSize: 13, fontWeight: '600' },
});
