import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useActivities, weeklyVolume } from '../hooks/useActivities';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { RankWidget } from '../components/RankWidget';
import { TrainlyButton } from '../components/TrainlyButton';
import { RegisterActivityModal } from '../components/RegisterActivityModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionTitle } from '../components/SectionTitle';
import { ProgressBar } from '../components/ProgressBar';
import { StatTile } from '../components/StatTile';
import { SportBadge } from '../components/SportIcon';
import { FadeIn, prefersReducedMotion } from '../components/Motion';
import { SkeletonRow } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Text } from '../components/Typography';
import { formatClock, formatKm, formatKmShort } from '../lib/geo';
import { RootStackParamList } from '../navigation/types';

const CHART_HEIGHT = 74;

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

/** "4h05" / "45 min" — mais fácil de ler de relance que "04:05:12". */
function hoursMinutes(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function shortDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '');
}

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

  // Primeira carga: ainda não há nada pra mostrar — usa esqueleto em vez de
  // exibir zeros que parecem dado real (o "0,00 km" provisório de antes).
  const firstLoad = loading && activities.length === 0 && !error;

  const week = weeklyVolume(activities);
  const weekTotal = week.reduce((s, d) => s + d.km, 0);
  const maxKm = Math.max(1, ...week.map((d) => d.km));
  // weeklyVolume devolve os 7 dias terminando em hoje, então hoje é o último.
  const todayIndex = week.length - 1;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekActivities = activities.filter((a) => new Date(a.date) >= weekStart);
  const weekSeconds = weekActivities.reduce((s, a) => s + (a.duration_sec ?? 0), 0);

  const goalKm = profile?.monthly_goal_km ?? 50;
  // Compara mês E ano: só com o mês, uma corrida de setembro/2025 entrava na
  // meta de setembro/2026.
  const monthKm = activities
    .filter((a) => {
      const d = new Date(a.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, a) => s + Number(a.distance_km), 0);
  const goalPct = Math.min(100, Math.round((monthKm / goalKm) * 100));
  const goalLeft = Math.max(0, goalKm - monthKm);

  const firstName = profile?.name?.split(' ')[0] ?? '';

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
      >
        <ScreenHeader
          wash="dashboard"
          subtitle={greetingFor(now)}
          title={firstName || 'Atleta'}
          leading={<Avatar name={profile?.name ?? '?'} size={46} uri={profile?.avatar_url} />}
        />

        <FadeIn>
          <Card accent={colors.accentGradient} style={styles.heroCard}>
            <LinearGradient
              colors={[withAlpha(colors.primary, 0.16), 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <RankWidget xp={profile?.xp ?? 0} />
          </Card>
        </FadeIn>

        <FadeIn delay={70} style={styles.rowButtons}>
          <View style={{ flex: 1.15 }}>
            <TrainlyButton title="Iniciar corrida" icon="play" onPress={() => navigation.navigate('Run')} />
          </View>
          <View style={{ flex: 1 }}>
            <TrainlyButton
              title="Registrar"
              icon="add-circle-outline"
              variant="secondary"
              onPress={() => setModalVisible(true)}
            />
          </View>
        </FadeIn>

        <FadeIn delay={130}>
          <SectionTitle title="Últimos 7 dias" style={{ marginTop: 26 }} />
          <View style={styles.bento}>
            <StatTile
              size="lg"
              gradient={colors.accentGradient}
              icon="navigate"
              label="Distância na semana"
              value={`${formatKm(weekTotal)} km`}
              loading={firstLoad}
            />
            <View style={styles.bentoSmallRow}>
              <StatTile icon="flash" label="Atividades" value={String(weekActivities.length)} loading={firstLoad} />
              <StatTile icon="time" label="Tempo" value={hoursMinutes(weekSeconds)} loading={firstLoad} />
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={190}>
          <Card style={{ marginTop: 14 }}>
            <SectionTitle
              title="Volume semanal"
              right={
                <Text style={[styles.cardRight, { color: colors.textMuted }]}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>{formatKm(weekTotal)}</Text> km
                </Text>
              }
            />
            <View style={styles.chart}>
              {week.map((d, i) => (
                <WeekBar
                  key={`${d.label}-${i}`}
                  label={d.label}
                  km={d.km}
                  ratio={d.km / maxKm}
                  isToday={i === todayIndex}
                  index={i}
                />
              ))}
            </View>
          </Card>
        </FadeIn>

        <FadeIn delay={250}>
          <Card style={{ marginTop: 14 }}>
            <SectionTitle
              title="Meta do mês"
              right={<Text style={[styles.goalPct, { color: colors.accent }]}>{goalPct}%</Text>}
            />
            <ProgressBar progress={goalPct / 100} height={12} gradient={colors.accentGradient} delay={250} />
            <View style={styles.goalRow}>
              <Text style={[styles.caption, { color: colors.textMuted }]}>
                <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>{formatKm(monthKm)}</Text> de {goalKm} km
              </Text>
              {goalLeft > 0 ? (
                <Text style={[styles.caption, { color: colors.textMuted }]}>faltam {formatKm(goalLeft)} km</Text>
              ) : (
                <View style={styles.goalDone}>
                  <Ionicons name="trophy" size={13} color={colors.success} />
                  <Text style={[styles.caption, { color: colors.success, fontWeight: '800' }]}>Meta batida!</Text>
                </View>
              )}
            </View>
          </Card>
        </FadeIn>

        <FadeIn delay={310}>
          <Card style={{ marginTop: 14, marginBottom: 24, paddingBottom: 8 }}>
            <SectionTitle title="Atividades recentes" />
            {firstLoad ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : activities.length === 0 ? (
              <EmptyState
                compact
                icon={error ? 'cloud-offline-outline' : 'footsteps-outline'}
                title={error ? 'Não foi possível carregar' : 'Nenhuma atividade ainda'}
                message={
                  error
                    ? 'Puxe a tela pra baixo pra tentar de novo.'
                    : 'Toque em "Iniciar corrida" ou registre um treino feito em outro dia.'
                }
              />
            ) : (
              activities.slice(0, 5).map((a, i) => (
                <View
                  key={a.id}
                  style={[styles.activityItem, { borderColor: colors.border }, i === 0 && { borderTopWidth: 0 }]}
                >
                  <SportBadge type={a.type} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.activityTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {a.title || a.type}
                    </Text>
                    <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {shortDate(a.date)} · {formatKm(Number(a.distance_km))} km · {formatClock(a.duration_sec)}
                    </Text>
                  </View>
                  <View style={[styles.xpPill, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.xpPillText, { color: colors.primary }]}>+{a.xp_earned} XP</Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </FadeIn>

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

/** Uma barra do gráfico semanal — cresce animada ao aparecer. */
function WeekBar({ label, km, ratio, isToday, index }: { label: string; km: number; ratio: number; isToday: boolean; index: number }) {
  const { colors } = useTheme();
  const target = km > 0 ? Math.max(8, ratio * CHART_HEIGHT) : 5;
  const height = useRef(new Animated.Value(prefersReducedMotion() ? target : 5)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      height.setValue(target);
      return;
    }
    const a = Animated.timing(height, {
      toValue: target,
      duration: 650,
      delay: 180 + index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [height, target, index]);

  return (
    <View style={styles.barCol}>
      {/* Só marca o valor em cima das barras que têm algo, pra não
          encher o gráfico de "0,0" nos dias parados. */}
      <Text
        style={[styles.barValue, { color: km > 0 ? (isToday ? colors.accent : colors.textPrimary) : 'transparent' }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {formatKmShort(km)}
      </Text>
      <Animated.View
        style={[
          styles.bar,
          {
            height,
            backgroundColor: km > 0 ? withAlpha(colors.primary, isToday ? 1 : 0.38) : colors.border,
          },
        ]}
      >
        {isToday && km > 0 ? (
          <LinearGradient colors={colors.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        ) : null}
      </Animated.View>
      <Text style={[styles.barLabel, { color: isToday ? colors.accent : colors.textMuted }, isToday && { fontWeight: '800' }]}>
        {isToday ? 'Hoje' : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 130 },
  heroCard: { overflow: 'hidden' },
  rowButtons: { flexDirection: 'row', gap: 12, marginTop: 14 },
  bento: { gap: 10 },
  bentoSmallRow: { flexDirection: 'row', gap: 10 },
  cardRight: { fontSize: 12.5, fontWeight: '600' },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    height: CHART_HEIGHT + 44,
    alignItems: 'flex-end',
  },
  // minWidth 0 + alignSelf stretch: sem isso o rótulo de valor largo
  // ("2151,27") empurrava a própria coluna e encostava na vizinha.
  barCol: { alignItems: 'center', flex: 1, minWidth: 0 },
  bar: { width: 22, borderRadius: 7, overflow: 'hidden' },
  barValue: { fontSize: 10, fontWeight: '800', marginBottom: 6, alignSelf: 'stretch', textAlign: 'center' },
  barLabel: { fontSize: 11, marginTop: 8, fontWeight: '600' },
  goalPct: { fontSize: 16, fontWeight: '800' },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  goalDone: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  caption: { fontSize: 12.5, fontWeight: '600' },
  activityItem: {
    borderTopWidth: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityTitle: { fontSize: 14.5, fontWeight: '700', marginBottom: 3 },
  xpPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  xpPillText: { fontSize: 12, fontWeight: '800' },
});
