import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useActivities, weeklyVolume } from '../hooks/useActivities';
import { Card } from '../components/Card';
import { RankWidget } from '../components/RankWidget';
import { TrainlyButton } from '../components/TrainlyButton';
import { RegisterActivityModal } from '../components/RegisterActivityModal';
import { formatKm, formatKmShort } from '../lib/geo';
import { RootStackParamList } from '../navigation/types';

const TYPE_ICON: Record<string, string> = {
  Corrida: '🏃',
  Ciclismo: '🚴',
  Natação: '🏊',
  Caminhada: '🚶',
};

export function DashboardScreen() {
  const { colors } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const { activities, loading, error, createActivity, reload } = useActivities(profile?.id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const week = weeklyVolume(activities);
  const weekTotal = week.reduce((s, d) => s + d.km, 0);
  const maxKm = Math.max(1, ...week.map((d) => d.km));
  // weeklyVolume devolve os 7 dias terminando em hoje, então hoje é o último.
  const todayIndex = week.length - 1;
  const goalKm = profile?.monthly_goal_km ?? 50;
  // Compara mês E ano: só com o mês, uma corrida de setembro/2025 entrava na
  // meta de setembro/2026.
  const now = new Date();
  const monthKm = activities
    .filter((a) => {
      const d = new Date(a.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, a) => s + Number(a.distance_km), 0);
  const goalPct = Math.min(100, Math.round((monthKm / goalKm) * 100));

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
    >
      <Text style={[styles.greeting, { color: colors.textMuted }]}>Olá,</Text>
      <Text style={[styles.name, { color: colors.textPrimary }]}>{profile?.name ?? '...'}</Text>

      <Card style={{ marginTop: 20 }}>
        <RankWidget xp={profile?.xp ?? 0} />
      </Card>

      <View style={styles.rowButtons}>
        <View style={{ flex: 1 }}>
          <TrainlyButton title="Iniciar corrida" onPress={() => navigation.navigate('Run')} />
        </View>
        <View style={{ flex: 1 }}>
          <TrainlyButton
            title="Registrar manual"
            variant="secondary"
            onPress={() => setModalVisible(true)}
          />
        </View>
      </View>

      <Card style={{ marginTop: 16 }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Volume Semanal</Text>
        <View style={styles.chart}>
          {week.map((d, i) => {
            const isToday = i === todayIndex;
            return (
              <View key={`${d.label}-${i}`} style={styles.barCol}>
                {/* Só marca o valor em cima das barras que têm algo, pra não
                    encher o gráfico de "0,0" nos dias parados. */}
                <Text
                  style={[styles.barValue, { color: d.km > 0 ? colors.textPrimary : 'transparent' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatKmShort(d.km)}
                </Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (d.km / maxKm) * 62),
                      backgroundColor: d.km > 0 ? colors.primary : colors.border,
                      opacity: d.km > 0 && !isToday ? 0.55 : 1,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.barLabel,
                    { color: isToday ? colors.primary : colors.textMuted },
                    isToday && { fontWeight: '800' },
                  ]}
                >
                  {d.label}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.chartTotal, { color: colors.textPrimary }]}>
          Total: <Text style={{ fontWeight: '800' }}>{formatKm(weekTotal)} km</Text>
        </Text>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Meta do Mês</Text>
        <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.barFill, { width: `${goalPct}%`, backgroundColor: colors.primary }]} />
        </View>
        <Text style={[styles.caption, { color: colors.textMuted }]}>
          {formatKm(monthKm)} / {goalKm} km ({goalPct}%)
        </Text>
      </Card>

      <Card style={{ marginTop: 16, marginBottom: 24 }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Atividades Recentes</Text>
        {activities.length === 0 ? (
          <Text style={[styles.caption, { color: colors.textMuted, marginTop: 8 }]}>
            {error
              ? 'Não foi possível carregar — puxe a tela pra baixo pra tentar de novo.'
              : 'Nenhuma atividade ainda. Registre a primeira!'}
          </Text>
        ) : (
          activities.slice(0, 5).map((a) => (
            <View key={a.id} style={[styles.activityItem, { borderColor: colors.border }]}>
              <Text style={styles.activityIcon}>{TYPE_ICON[a.type] ?? '🏅'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {a.title || a.type}
                </Text>
                <Text style={[styles.caption, { color: colors.textMuted }]}>
                  {new Date(a.date).toLocaleDateString('pt-BR')} · {formatKm(Number(a.distance_km))} km
                </Text>
              </View>
              <Text style={[styles.activityXp, { color: colors.primary }]}>+{a.xp_earned} XP</Text>
            </View>
          ))
        )}
      </Card>

      <RegisterActivityModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={async (input) => {
          const xp = await createActivity(input);
          await refreshProfile();
          return xp;
        }}
      />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 14, fontWeight: '600' },
  name: { fontSize: 26, fontWeight: '900', marginTop: 2 },
  rowButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cardTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, height: 104, alignItems: 'flex-end' },
  // minWidth 0 + alignSelf stretch: sem isso o rótulo de valor largo
  // ("2151,27") empurrava a própria coluna e encostava na vizinha.
  barCol: { alignItems: 'center', flex: 1, minWidth: 0 },
  bar: { width: 14, borderRadius: 4 },
  barValue: { fontSize: 9.5, fontWeight: '800', marginBottom: 5, alignSelf: 'stretch', textAlign: 'center' },
  barLabel: { fontSize: 10.5, marginTop: 6, fontWeight: '600' },
  chartTotal: { marginTop: 14, fontSize: 13 },
  barTrack: { height: 8, borderRadius: 4, marginTop: 14, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  caption: { fontSize: 12.5, fontWeight: '600' },
  activityItem: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIcon: { fontSize: 22 },
  activityTitle: { fontSize: 14.5, fontWeight: '700', marginBottom: 4 },
  activityXp: { fontSize: 12.5, fontWeight: '800' },
});
