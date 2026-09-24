import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useActivities } from '../hooks/useActivities';
import { supabase } from '../lib/supabase';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { RankWidget } from '../components/RankWidget';
import { RankTrail } from '../components/RankTrail';
import { TrainlyButton } from '../components/TrainlyButton';
import { EditProfileModal } from '../components/EditProfileModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionTitle } from '../components/SectionTitle';
import { StatTile } from '../components/StatTile';
import { AchievementsPreviewCard } from '../components/AchievementsPreviewCard';
import { FadeIn } from '../components/Motion';
import { Text } from '../components/Typography';
import { RootStackParamList } from '../navigation/types';
import { warning } from '../lib/haptics';
import { activityStats } from '../lib/stats';
import { formatClock, formatKm } from '../lib/geo';
import { levelInfo } from '../lib/rank';

export function ProfileScreen() {
  const { colors, mode, toggle } = useTheme();
  const { profile, refreshProfile, signOut } = useAuth();
  const { activities, loading, reload } = useActivities(profile?.id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [editVisible, setEditVisible] = useState(false);

  // Sem isso, o Resumo/Recordes ficava com números velhos depois de registrar
  // uma atividade em outra aba e voltar pro Perfil sem reiniciar o app.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const stats = activityStats(activities);
  const rankInfo = levelInfo(profile?.xp ?? 0);

  const handleSaveProfile = async (fields: {
    name: string;
    location: string;
    bio: string;
    monthlyGoalKm: number;
    avatarUrl: string | null;
  }) => {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        name: fields.name,
        location: fields.location || null,
        bio: fields.bio || null,
        monthly_goal_km: fields.monthlyGoalKm,
        avatar_url: fields.avatarUrl,
      })
      .eq('id', profile.id);
    if (error) throw error;
    await refreshProfile();
  };

  const handleLogout = () => {
    warning();
    Alert.alert('Trainly', 'Tem certeza que quer sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ]);
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
          <Avatar name={profile?.name ?? '?'} size={88} uri={profile?.avatar_url} ringColor={rankInfo.rank.color} zoomable />
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
              title={mode === 'dark' ? 'Modo claro' : 'Modo escuro'}
              variant="secondary"
              onPress={toggle}
            />
          </View>
        </FadeIn>

        <FadeIn delay={90} style={{ marginTop: 16 }}>
          <AchievementsPreviewCard
            userId={profile?.id}
            onPress={() => {
              if (!profile) return;
              navigation.navigate('Achievements', { userId: profile.id, name: profile.name });
            }}
          />
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
            <SectionTitle title="Resumo" />
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

        <TrainlyButton title="Sair da conta" variant="danger" onPress={handleLogout} />

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
  name: { fontSize: 20, fontWeight: '900', marginTop: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  location: { fontSize: 13, fontWeight: '600' },
  bio: { fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  rowButtons: { flexDirection: 'row', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
