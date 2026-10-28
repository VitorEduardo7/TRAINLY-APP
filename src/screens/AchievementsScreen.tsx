import React, { useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AchievementState, useAchievements } from '../hooks/useAchievements';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FadeIn } from '../components/Motion';
import { ProgressBar } from '../components/ProgressBar';
import { SectionTitle } from '../components/SectionTitle';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { AchievementBadge } from '../components/AchievementBadge';
import { Text } from '../components/Typography';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  TIER_LABEL,
  achievementTierColor,
  progressRatio,
  progressText,
} from '../lib/achievements';
import { AchievementTier } from '../types/models';
import { RootStackParamList } from '../navigation/types';

type AchievementsRouteProp = RouteProp<RootStackParamList, 'Achievements'>;
type Filter = 'todas' | 'desbloqueadas' | 'faltando';

const TIERS: AchievementTier[] = ['bronze', 'prata', 'ouro', 'lendaria'];

// Todas as conquistas (desbloqueadas e por vir) de um usuário — a própria ou
// de outra pessoa (aberta a partir do perfil dela), separadas por grupo.
// A descrição de uma trancada fica visível de propósito: funciona como meta.
// Só as SECRETAS ficam escondidas ("???") até alguém desbloquear.
export function AchievementsScreen() {
  const { colors, colorBlindMode } = useTheme();
  const { params } = useRoute<AchievementsRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { achievements, unlockedCount, total, loading, error, reload } = useAchievements(params.userId);
  const [filter, setFilter] = useState<Filter>('todas');

  useLayoutEffect(() => {
    navigation.setOptions({ title: params.name ? `Conquistas de ${params.name.split(' ')[0]}` : 'Conquistas' });
  }, [navigation, params.name]);

  const tierCounts = useMemo(
    () =>
      TIERS.map((tier) => {
        const all = achievements.filter((a) => (a.tier ?? 'bronze') === tier);
        return { tier, done: all.filter((a) => a.unlocked).length, total: all.length };
      }).filter((t) => t.total > 0),
    [achievements],
  );

  // "Quase lá": as trancadas mais perto de sair (com barra de progresso).
  const almost = useMemo(
    () =>
      achievements
        .filter((a) => !a.unlocked && !a.secret)
        .map((a) => ({ a, ratio: progressRatio(a, a.current) ?? 0 }))
        .filter((x) => x.ratio >= 0.4)
        .sort((x, y) => y.ratio - x.ratio)
        .slice(0, 3)
        .map((x) => x.a),
    [achievements],
  );

  const groups = useMemo(() => {
    const visible = achievements.filter((a) =>
      filter === 'desbloqueadas' ? a.unlocked : filter === 'faltando' ? !a.unlocked : true,
    );
    const order = [...CATEGORY_ORDER, ...Array.from(new Set(visible.map((a) => a.category))).filter((c) => !CATEGORY_ORDER.includes(c))];
    return order
      .map((category) => ({
        category,
        items: visible.filter((a) => a.category === category),
        done: achievements.filter((a) => a.category === category && a.unlocked).length,
        count: achievements.filter((a) => a.category === category).length,
      }))
      .filter((g) => g.items.length > 0);
  }, [achievements, filter]);

  if (loading && achievements.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error && achievements.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Não foi possível carregar"
          message="Confira sua internet e puxe a tela pra baixo pra tentar de novo."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
    >
      <FadeIn>
        <Card>
          <View style={styles.summaryTop}>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {unlockedCount}
              <Text style={[styles.summaryTotal, { color: colors.textMuted }]}>/{total}</Text>
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>conquistas{'\n'}desbloqueadas</Text>
          </View>
          <ProgressBar progress={total ? unlockedCount / total : 0} height={8} gradient={colors.goldGradient} style={{ marginTop: 12 }} />
          <View style={styles.tierRow}>
            {tierCounts.map((t) => (
              <View key={t.tier} style={styles.tierItem}>
                <View style={[styles.tierDot, { backgroundColor: achievementTierColor(t.tier, colorBlindMode) }]} />
                <Text style={[styles.tierText, { color: colors.textMuted }]}>
                  {TIER_LABEL[t.tier]}{' '}
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                    {t.done}/{t.total}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </FadeIn>

      <SegmentedTabs
        options={[
          { value: 'todas', label: 'Todas' },
          { value: 'desbloqueadas', label: 'Feitas', count: unlockedCount },
          { value: 'faltando', label: 'Faltam', count: total - unlockedCount },
        ]}
        value={filter}
        onChange={setFilter}
        style={{ marginTop: 16 }}
      />

      {filter !== 'desbloqueadas' && almost.length > 0 && (
        <FadeIn delay={60}>
          <SectionTitle title="Quase lá" style={{ marginTop: 24 }} />
          <Card style={{ paddingVertical: 6 }}>
            {almost.map((a, i) => (
              <AlmostRow key={a.id} item={a} first={i === 0} />
            ))}
          </Card>
        </FadeIn>
      )}

      {groups.length === 0 ? (
        <EmptyState
          compact
          icon="trophy-outline"
          title={filter === 'desbloqueadas' ? 'Nenhuma ainda' : 'Todas feitas!'}
          message={filter === 'desbloqueadas' ? 'Registre um treino pra começar a desbloquear.' : 'Você desbloqueou tudo. Lenda.'}
        />
      ) : (
        groups.map((g, gi) => (
          <FadeIn key={g.category} delay={Math.min(gi, 4) * 50}>
            <SectionTitle
              title={CATEGORY_LABEL[g.category] ?? g.category}
              right={
                <Text style={[styles.groupCount, { color: colors.textMuted }]}>
                  {g.done}/{g.count}
                </Text>
              }
              style={{ marginTop: 24 }}
            />
            <View style={styles.grid}>
              {g.items.map((a) => (
                <View key={a.id} style={styles.cardWrap}>
                  <AchievementCard item={a} />
                </View>
              ))}
            </View>
          </FadeIn>
        ))
      )}
    </ScrollView>
  );
}

function AchievementCard({ item: a }: { item: AchievementState }) {
  const { colors, colorBlindMode } = useTheme();
  const hidden = !!a.secret && !a.unlocked;
  const tint = achievementTierColor(a.tier, colorBlindMode);
  const ratio = a.unlocked ? null : progressRatio(a, a.current);
  const progress = a.unlocked || hidden ? null : progressText(a, a.current);

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <AchievementBadge icon={a.icon} tier={a.tier} unlocked={a.unlocked} hidden={hidden} />
        <View style={styles.tierChip}>
          <View style={[styles.tierDot, { backgroundColor: a.unlocked ? tint : colors.border }]} />
          <Text style={[styles.tierChipText, { color: colors.textMuted }]}>{TIER_LABEL[a.tier ?? 'bronze']}</Text>
        </View>
      </View>
      <Text style={[styles.title, { color: a.unlocked ? colors.textPrimary : colors.textMuted }]} numberOfLines={2}>
        {hidden ? '???' : a.title}
      </Text>
      <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={3}>
        {hidden ? 'Conquista secreta. Continue treinando pra descobrir.' : a.description}
      </Text>

      {ratio != null ? <ProgressBar progress={ratio} height={4} color={colors.primary} style={{ marginTop: 10 }} /> : null}
      {progress ? <Text style={[styles.progress, { color: colors.textMuted }]}>{progress}</Text> : null}

      <View style={styles.footer}>
        <View style={[styles.xpPill, { backgroundColor: a.unlocked ? colors.goldSoft : colors.surface }]}>
          <Ionicons name="star" size={11} color={a.unlocked ? colors.goldText : colors.textMuted} />
          <Text style={[styles.xpText, { color: a.unlocked ? colors.goldText : colors.textMuted }]}>+{a.xp_reward} XP</Text>
        </View>
        {a.unlocked && a.unlockedAt ? (
          <Text style={[styles.unlockedDate, { color: colors.textMuted }]}>
            {new Date(a.unlockedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function AlmostRow({ item: a, first }: { item: AchievementState; first: boolean }) {
  const { colors } = useTheme();
  const ratio = progressRatio(a, a.current) ?? 0;
  return (
    <View style={[styles.almostRow, { borderColor: colors.border }, first && { borderTopWidth: 0 }]}>
      <AchievementBadge icon={a.icon} tier={a.tier} unlocked={false} size={38} />
      <View style={{ flex: 1 }}>
        <View style={styles.almostTop}>
          <Text style={[styles.almostTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {a.title}
          </Text>
          <Text style={[styles.almostPct, { color: colors.textPrimary }]}>{Math.floor(ratio * 100)}%</Text>
        </View>
        <ProgressBar progress={ratio} height={4} color={colors.primary} style={{ marginTop: 6 }} />
        <Text style={[styles.progress, { color: colors.textMuted }]}>{progressText(a, a.current)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 40 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  summaryValue: { fontSize: 52, fontWeight: '900', fontStyle: 'italic', lineHeight: 56 },
  summaryTotal: { fontSize: 26, fontWeight: '800', fontStyle: 'italic' },
  summaryLabel: { fontSize: 13, fontWeight: '600', lineHeight: 17, marginBottom: 8 },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  tierItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierText: { fontSize: 12.5, fontWeight: '500' },
  groupCount: { fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardWrap: { flexBasis: '47%', flexGrow: 1 },
  card: { flex: 1, minHeight: 176, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  tierChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  tierChipText: { fontSize: 10.5, fontWeight: '700' },
  title: { fontSize: 13.5, fontWeight: '800', marginBottom: 4 },
  description: { fontSize: 11.5, fontWeight: '500', lineHeight: 15.5 },
  progress: { fontSize: 11, fontWeight: '600', marginTop: 5 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10 },
  xpPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  xpText: { fontSize: 10, fontWeight: '800' },
  unlockedDate: { fontSize: 10, fontWeight: '700' },
  almostRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  almostTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  almostTitle: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  almostPct: { fontSize: 13, fontWeight: '800' },
});
