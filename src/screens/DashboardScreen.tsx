import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { streakColors, withAlpha } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useActivities, weeklyVolume } from '../hooks/useActivities';
import { useQuests } from '../hooks/useQuests';
import { useStreak } from '../hooks/useStreak';
import { effectiveTier, emblemFor, levelInfo } from '../lib/rank';
import { effectiveStreak } from '../lib/streak';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { LapTrack } from '../components/LapTrack';
import { NotificationBell } from '../components/NotificationBell';
import { SegmentedBar } from '../components/SegmentedBar';
import { RankBadge } from '../components/RankBadge';
import { TrainlyButton } from '../components/TrainlyButton';
import { RegisterActivityModal } from '../components/RegisterActivityModal';
import { QuestsCard } from '../components/QuestsCard';
import { SectionTitle } from '../components/SectionTitle';
import { SportBadge } from '../components/SportIcon';
import { XpChip } from '../components/XpChip';
import { FadeIn, PressableScale, prefersReducedMotion } from '../components/Motion';
import { Skeleton, SkeletonRow } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Text } from '../components/Typography';
import { formatClock, formatKm, formatKmShort } from '../lib/geo';
import { RootStackParamList } from '../navigation/types';

const CHART_HEIGHT = 96;

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
  const { colors, colorBlindMode } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const { activities, loading, error, createActivity, reload } = useActivities(profile?.id);
  const { daily, weekly, completedCount, total: questTotal, loading: questsLoading, reload: reloadQuests } = useQuests(
    profile?.id,
  );
  const { streak, reload: reloadStreak } = useStreak(profile?.id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
      reloadQuests();
      reloadStreak();
    }, [reload, reloadQuests, reloadStreak]),
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
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' });

  const firstName = profile?.name?.split(' ')[0] ?? '';
  const info = levelInfo(profile?.xp ?? 0, colorBlindMode);
  const missing = Math.max(0, info.xpToNext - info.xpIntoLevel);
  const frame = effectiveTier(profile?.xp ?? 0, profile?.equipped_frame_tier, colorBlindMode);
  const streakNow = effectiveStreak(streak);
  const { fire, ice } = streakColors(colorBlindMode);
  const flameColor =
    streakNow.status === 'protected'
      ? ice
      : streakNow.status === 'active_this_week' || streakNow.status === 'needs_activity'
        ? fire
        : colors.textMuted;
  const { width: windowWidth } = useWindowDimensions();
  const trackWidth = windowWidth - 40;

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
      >
        <View style={styles.topRow}>
          <Avatar name={profile?.name ?? '?'} size={44} uri={profile?.avatar_url} ringColor={frame.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>{greetingFor(now)}</Text>
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {firstName || 'Atleta'}
            </Text>
          </View>
          <PressableScale
            onPress={() => profile && navigation.navigate('Streak', { userId: profile.id })}
            accessibilityRole="button"
            accessibilityLabel={`Sequência de ${streakNow.count} semanas`}
            style={[styles.streakChip, { borderColor: colors.border }]}
          >
            <Ionicons name={streakNow.status === 'protected' ? 'snow' : 'flame'} size={17} color={flameColor} />
            <Text style={[styles.streakCount, { color: colors.textPrimary }]}>{streakNow.count}</Text>
          </PressableScale>
          <NotificationBell />
        </View>

        {/* Assinatura do Início: o XP rumo ao próximo nível como uma VOLTA
            na pista. O resto da tela fica quieto em volta disso. */}
        <FadeIn style={styles.hero}>
          <LapTrack width={trackWidth} progress={info.xpToNext > 0 ? info.xpIntoLevel / info.xpToNext : 0}>
            <View style={styles.infieldRow}>
              <RankBadge icon={emblemFor(info.rank.name)} color={info.rank.color} size={40} />
              <View>
                <Text style={[styles.levelText, { color: colors.textPrimary }]}>Nível {info.level}</Text>
                <Text style={[styles.rankLine, { color: colors.textMuted }]}>
                  Patente <Text style={{ color: info.rank.color, fontWeight: '600' }}>{info.rank.name}</Text>
                </Text>
              </View>
            </View>
          </LapTrack>
          <View style={styles.lapCaption}>
            <Text style={[styles.caption, { color: colors.textMuted }]}>
              <Text style={{ color: colors.goldText, fontWeight: '700' }}>{info.xpIntoLevel}</Text> de {info.xpToNext} XP nesta volta
            </Text>
            <Text style={[styles.caption, { color: colors.textMuted }]}>
              faltam {missing} pro nível {info.level + 1}
            </Text>
          </View>
        </FadeIn>

        <FadeIn delay={70} style={styles.rowButtons}>
          <View style={{ flex: 1 }}>
            <TrainlyButton size="lg" title="Iniciar corrida" icon="play" onPress={() => navigation.navigate('Run')} />
          </View>
          <TrainlyButton
            size="lg"
            square
            title="Registrar treino"
            icon="add"
            variant="secondary"
            accessibilityLabel="Registrar um treino feito em outro dia"
            onPress={() => setModalVisible(true)}
          />
        </FadeIn>

        <FadeIn delay={100}>
          <QuestsCard daily={daily} weekly={weekly} completedCount={completedCount} total={questTotal} loading={questsLoading} />
        </FadeIn>

        <FadeIn delay={140}>
          <SectionTitle title="Últimos 7 dias" style={{ marginTop: 30 }} />
          <Card>
            {firstLoad ? (
              <Skeleton width={130} height={40} />
            ) : (
              <Text style={[styles.weekKm, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {formatKm(weekTotal)}
                <Text style={[styles.weekUnit, { color: colors.textMuted }]}> km</Text>
              </Text>
            )}
            <Text style={[styles.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {weekActivities.length === 1 ? '1 treino' : `${weekActivities.length} treinos`}, {hoursMinutes(weekSeconds)} em movimento
            </Text>
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

        <FadeIn delay={190}>
          <Card style={{ marginTop: 12 }}>
            <View style={styles.goalTop}>
              <Text style={[styles.goalTitle, { color: colors.textPrimary }]}>Meta de {monthName}</Text>
              <Text style={[styles.goalPct, { color: goalLeft > 0 ? colors.textPrimary : colors.success }]}>{goalPct}%</Text>
            </View>
            <SegmentedBar progress={goalPct / 100} segments={20} height={10} color={goalLeft > 0 ? colors.primary : colors.success} />
            <Text style={[styles.caption, { color: colors.textMuted, marginTop: 10 }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{formatKm(monthKm)}</Text> de {goalKm} km
              {goalLeft > 0 ? `, faltam ${formatKm(goalLeft)} km` : ', meta batida'}
            </Text>
          </Card>
        </FadeIn>

        <FadeIn delay={240}>
          <SectionTitle title="Atividades recentes" style={{ marginTop: 30 }} />
          <Card style={{ paddingVertical: 4, marginBottom: 24 }}>
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
                  <SportBadge type={a.type} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.activityTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {a.title || a.type}
                    </Text>
                    <Text style={[styles.caption, { color: colors.textMuted }]} numberOfLines={1}>
                      {shortDate(a.date)}, {formatKm(Number(a.distance_km))} km em {formatClock(a.duration_sec)}
                    </Text>
                  </View>
                  <XpChip xp={a.xp_earned} />
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
            await Promise.all([refreshProfile(), reloadQuests(), reloadStreak()]);
            return xp;
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Uma barra do gráfico semanal — coluna fina que cresce ao aparecer. */
function WeekBar({ label, km, ratio, isToday, index }: { label: string; km: number; ratio: number; isToday: boolean; index: number }) {
  const { colors } = useTheme();
  const target = km > 0 ? Math.max(10, ratio * CHART_HEIGHT) : 4;
  const height = useRef(new Animated.Value(prefersReducedMotion() ? target : 4)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      height.setValue(target);
      return;
    }
    const a = Animated.timing(height, {
      toValue: target,
      duration: 650,
      delay: 180 + index * 50,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [height, target, index]);

  const fill = km <= 0 ? colors.surface : isToday ? colors.primary : withAlpha(colors.primary, 0.4);

  return (
    <View style={styles.barCol}>
      {/* Só marca o valor em cima das barras que têm algo, pra não
          encher o gráfico de "0,0" nos dias parados. */}
      <Text
        style={[styles.barValue, { color: km > 0 ? (isToday ? colors.textPrimary : colors.textMuted) : 'transparent' }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {formatKmShort(km)}
      </Text>
      <Animated.View style={[styles.bar, { height, backgroundColor: fill }]} />
      <Text style={[styles.barLabel, { color: isToday ? colors.textPrimary : colors.textMuted }, isToday && { fontWeight: '700' }]}>
        {isToday ? 'Hoje' : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 130 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  greeting: { fontSize: 13.5, fontWeight: '500' },
  name: { fontSize: 30, fontWeight: '900', lineHeight: 32 },
  streakChip: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 21,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  streakCount: { fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  hero: { marginTop: 24, marginBottom: 20 },
  infieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelText: { fontSize: 40, fontWeight: '900', fontStyle: 'italic', lineHeight: 42 },
  rankLine: { fontSize: 13, fontWeight: '500' },
  lapCaption: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  rowButtons: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  weekKm: { fontSize: 52, fontWeight: '900', fontStyle: 'italic', lineHeight: 56, flexShrink: 1 },
  weekUnit: { fontSize: 22, fontWeight: '800', fontStyle: 'normal' },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    height: CHART_HEIGHT + 44,
    alignItems: 'flex-end',
  },
  // minWidth 0 + alignSelf stretch: sem isso o rótulo de valor largo
  // ("2151,27") empurrava a própria coluna e encostava na vizinha.
  barCol: { alignItems: 'center', flex: 1, minWidth: 0 },
  bar: { width: 10, borderRadius: 5 },
  barValue: { fontSize: 11, fontWeight: '600', marginBottom: 6, alignSelf: 'stretch', textAlign: 'center' },
  barLabel: { fontSize: 11.5, marginTop: 8, fontWeight: '500' },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  goalTitle: { fontSize: 22, fontWeight: '800' },
  goalPct: { fontSize: 30, fontWeight: '900', fontStyle: 'italic' },
  caption: { fontSize: 13, fontWeight: '500' },
  activityItem: {
    borderTopWidth: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityTitle: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
});
