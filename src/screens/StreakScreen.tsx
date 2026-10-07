import React, { useLayoutEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { streakColors, withAlpha } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useStreak } from '../hooks/useStreak';
import { useActivities } from '../hooks/useActivities';
import { effectiveStreak, mondayOf } from '../lib/streak';
import { Card } from '../components/Card';
import { SectionTitle } from '../components/SectionTitle';
import { SportBadge } from '../components/SportIcon';
import { EmptyState } from '../components/EmptyState';
import { FadeIn } from '../components/Motion';
import { Text } from '../components/Typography';
import { formatClock, formatKm } from '../lib/geo';
import { RootStackParamList } from '../navigation/types';
import { XpChip } from '../components/XpChip';

type StreakRouteProp = RouteProp<RootStackParamList, 'Streak'>;

const CHART_HEIGHT = 88;
const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

/**
 * Detalhe da sequência semanal: calendário segunda-a-domingo da semana
 * ATUAL (não "últimos 7 dias" como o gráfico do Dashboard) — laranja no dia
 * que treinou, azul escuro no dia de descanso, e as atividades da semana
 * embaixo. Aberta ao tocar no `StreakBadge`, no lugar do alerta de texto
 * que existia antes.
 */
export function StreakScreen() {
  const { colors, colorBlindMode } = useTheme();
  const { fire: FIRE, ice: ICE, rest: REST } = streakColors(colorBlindMode);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<StreakRouteProp>();
  const { profile: me } = useAuth();
  const { streak, loading: streakLoading } = useStreak(params.userId);
  const { activities, loading: activitiesLoading } = useActivities(params.userId);

  const isMe = me?.id === params.userId;
  const firstName = params.name ?? 'Ele';

  useLayoutEffect(() => {
    navigation.setOptions({ title: isMe ? 'Sua sequência' : `Sequência de ${firstName.split(' ')[0]}` });
  }, [navigation, isMe, firstName]);

  const effective = effectiveStreak(streak);
  const frozen = effective.status === 'protected';
  const tint = frozen ? ICE : effective.status === 'needs_activity' ? withAlpha(FIRE, 0.8) : FIRE;

  const monday = useMemo(() => mondayOf(new Date()), []);
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekDays = useMemo(
    () =>
      DAY_LABELS.map((label, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dayActivities = activities.filter((a) => sameDay(new Date(a.date), date));
        const km = dayActivities.reduce((sum, a) => sum + Number(a.distance_km), 0);
        return {
          label,
          date,
          km,
          active: dayActivities.length > 0,
          isToday: sameDay(date, todayStart),
          isFuture: date.getTime() > todayStart.getTime(),
        };
      }),
    [activities, monday, todayStart],
  );

  const maxKm = Math.max(1, ...weekDays.map((d) => d.km));

  const weekActivities = useMemo(
    () => activities.filter((a) => weekDays.some((d) => d.active && sameDay(new Date(a.date), d.date))),
    [activities, weekDays],
  );
  const weekKm = weekActivities.reduce((s, a) => s + Number(a.distance_km), 0);

  const statusText = useMemo(() => {
    const who = isMe ? 'Você está' : `${firstName.split(' ')[0]} está`;
    if (effective.status === 'none') {
      return isMe ? 'Você ainda não começou uma sequência — treine essa semana pra acender o foguinho.' : `${firstName.split(' ')[0]} ainda não começou uma sequência.`;
    }
    const weeks = effective.count === 1 ? '1 semana' : `${effective.count} semanas`;
    let detail = `${who} há ${weeks} seguidas treinando pelo menos uma vez por semana.`;
    if (effective.status === 'needs_activity') {
      detail += isMe ? ' Treine essa semana pra manter a sequência.' : ' Precisa treinar essa semana pra manter a sequência.';
    } else if (frozen && streak) {
      detail += ` Protegida por congelamento (${streak.freezes_available} disponível${streak.freezes_available === 1 ? '' : 'is'}).`;
    }
    return detail;
  }, [effective, firstName, frozen, isMe, streak]);

  const loading = streakLoading || activitiesLoading;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <FadeIn>
        <Card style={styles.heroCard}>
          <View style={[styles.heroIcon, { backgroundColor: withAlpha(tint, 0.14) }]}>
            <Ionicons name={frozen ? 'snow' : 'flame'} size={30} color={tint} />
          </View>
          <Text style={[styles.heroCount, { color: colors.textPrimary }]}>{effective.count}</Text>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
            {effective.count === 1 ? 'semana seguida' : 'semanas seguidas'}
          </Text>
          <Text style={[styles.heroDetail, { color: colors.textMuted }]}>{statusText}</Text>
        </Card>
      </FadeIn>

      <FadeIn delay={60}>
        <Card style={{ marginTop: 16 }}>
          <SectionTitle
            title="Atividade da semana"
            right={<Text style={[styles.weekRange, { color: colors.textMuted }]}>{formatKm(weekKm)} km</Text>}
          />
          <View style={styles.chart}>
            {weekDays.map((d) => (
              <DayBar key={d.label} {...d} maxKm={maxKm} />
            ))}
          </View>
          <View style={styles.legend}>
            <LegendDot color={FIRE} label="Treinou" />
            <LegendDot color={REST} label="Descanso" />
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={100}>
        <Card style={{ marginTop: 16, marginBottom: 24, paddingBottom: 8 }}>
          <SectionTitle title="Atividades desta semana" />
          {loading && weekActivities.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : weekActivities.length === 0 ? (
            <EmptyState
              compact
              icon="footsteps-outline"
              title="Nada essa semana ainda"
              message={isMe ? 'Registre uma atividade pra ela aparecer aqui.' : `${firstName.split(' ')[0]} ainda não treinou essa semana.`}
            />
          ) : (
            weekActivities.map((a, i) => (
              <View
                key={a.id}
                style={[styles.activityItem, { borderColor: colors.border }, i === 0 && { borderTopWidth: 0 }]}
              >
                <SportBadge type={a.type} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activityTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {a.title || a.type}
                  </Text>
                  <Text style={[styles.activityMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {shortDate(a.date)}, {formatKm(Number(a.distance_km))} km em {formatClock(a.duration_sec)}
                  </Text>
                </View>
                <XpChip xp={a.xp_earned} />
              </View>
            ))
          )}
        </Card>
      </FadeIn>
    </ScrollView>
  );
}

function DayBar({
  label,
  km,
  active,
  isToday,
  isFuture,
  maxKm,
}: {
  label: string;
  km: number;
  active: boolean;
  isToday: boolean;
  isFuture: boolean;
  maxKm: number;
}) {
  const { colors, colorBlindMode } = useTheme();
  const { fire: FIRE, rest: REST } = streakColors(colorBlindMode);
  // Dia com treino cresce proporcional ao km (mínimo pra sempre aparecer
  // algo); descanso fica numa barrinha baixa fixa; dia futuro só um traço
  // pontilhado, sem cor — ainda não é nem treino nem descanso de verdade.
  const target = active ? Math.max(16, (km / maxKm) * CHART_HEIGHT) : 10;

  return (
    <View style={styles.barCol}>
      <View
        style={[
          styles.bar,
          isFuture
            ? { height: 10, backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border }
            : { height: target, backgroundColor: active ? FIRE : REST },
        ]}
      />
      <Text style={[styles.barLabel, { color: isToday ? FIRE : colors.textMuted }, isToday && { fontWeight: '800' }]}>
        {label}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  heroCard: { alignItems: 'center', paddingVertical: 28 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroCount: { fontSize: 72, fontWeight: '900', fontStyle: 'italic', lineHeight: 76 },
  heroLabel: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  heroDetail: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 14, lineHeight: 19, paddingHorizontal: 12 },
  weekRange: { fontSize: 12.5, fontWeight: '700' },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 30,
    marginTop: 10,
  },
  barCol: { alignItems: 'center', flex: 1, minWidth: 0 },
  bar: { width: 20, borderRadius: 7 },
  barLabel: { fontSize: 11, marginTop: 8, fontWeight: '600' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendLabel: { fontSize: 11.5, fontWeight: '600' },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  activityTitle: { fontSize: 14, fontWeight: '700' },
  activityMeta: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  xpPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  xpPillText: { fontSize: 11, fontWeight: '800' },
});
