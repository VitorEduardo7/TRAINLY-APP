import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
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
import { activityStats } from '../lib/stats';
import { formatClock, formatKm } from '../lib/geo';

export function ProfileScreen() {
  const { colors, mode, toggle } = useTheme();
  const { profile, refreshProfile, signOut } = useAuth();
  const { activities, loading, reload } = useActivities(profile?.id);
  const [editVisible, setEditVisible] = useState(false);

  // Sem isso, o Resumo/Recordes ficava com números velhos depois de registrar
  // uma atividade em outra aba e voltar pro Perfil sem reiniciar o app.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const stats = activityStats(activities);

  const handleSaveProfile = async (fields: {
    name: string;
    location: string;
    bio: string;
    monthlyGoalKm: number;
  }) => {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        name: fields.name,
        location: fields.location || null,
        bio: fields.bio || null,
        monthly_goal_km: fields.monthlyGoalKm,
      })
      .eq('id', profile.id);
    if (error) throw error;
    await refreshProfile();
  };

  const handleLogout = () => {
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
      <ScreenHeader title="Perfil" />

      <View style={styles.header}>
        <Avatar name={profile?.name ?? '?'} size={88} />
        <Text style={[styles.name, { color: colors.textPrimary }]}>{profile?.name}</Text>
        {profile?.location ? (
          <Text style={[styles.location, { color: colors.textMuted }]}>📍 {profile.location}</Text>
        ) : null}
        {profile?.bio ? (
          <Text style={[styles.bio, { color: colors.textMuted }]}>{profile.bio}</Text>
        ) : null}
      </View>

      <View style={styles.rowButtons}>
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
      </View>

      <Card style={{ marginTop: 16 }}>
        <RankWidget xp={profile?.xp ?? 0} />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Patentes</Text>
        <RankTrail xp={profile?.xp ?? 0} />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Resumo</Text>
        <View style={styles.grid}>
          <Metric label="Distância Total" value={`${formatKm(stats.totalKm)} km`} colors={colors} />
          <Metric label="Tempo Ativo" value={formatClock(stats.totalSec)} colors={colors} />
          <Metric label="Elevação Acum." value={`${stats.totalElev} m`} colors={colors} />
          <Metric label="Atividades" value={String(stats.count)} colors={colors} />
          <Metric label="Dias Ativos" value={`${stats.activeDays} dias`} colors={colors} />
          <Metric label="XP Total" value={(profile?.xp ?? 0).toLocaleString('pt-BR')} colors={colors} />
        </View>
      </Card>

      <Card style={{ marginTop: 16, marginBottom: 24 }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Recordes Pessoais</Text>
        <View style={styles.grid}>
          <Metric label="Maior Distância" value={`${formatKm(stats.bestDistanceKm)} km`} colors={colors} />
          <Metric label="Maior Duração" value={formatClock(stats.longestDurationSec)} colors={colors} />
        </View>
      </Card>

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

function Metric({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 20, fontWeight: '900', marginTop: 12 },
  location: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  bio: { fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  rowButtons: { flexDirection: 'row', gap: 12 },
  cardTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  metric: { width: '40%' },
  metricLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  metricValue: { fontSize: 18, fontWeight: '800' },
});
