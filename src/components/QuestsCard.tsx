import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Card } from './Card';
import { SectionTitle } from './SectionTitle';
import { SegmentedBar } from './SegmentedBar';
import { Text } from './Typography';
import type { CurrentQuest } from '../types/models';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function unitLabel(quest: CurrentQuest): string {
  if (quest.goal_type === 'distance_km') return 'km';
  if (quest.goal_type === 'duration_min') return 'min';
  return quest.goal_value === 1 ? 'atividade' : 'atividades';
}

function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function QuestRow({ quest, first }: { quest: CurrentQuest; first: boolean }) {
  const { colors } = useTheme();
  const pct = quest.goal_value > 0 ? Math.min(1, quest.progress / quest.goal_value) : 0;
  const tint = quest.completed ? colors.success : colors.primary;

  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={[styles.icon, { borderColor: quest.completed ? colors.success : colors.border }]}>
        <Ionicons
          name={(quest.completed ? 'checkmark' : quest.icon) as IconName}
          size={16}
          color={quest.completed ? colors.success : colors.textPrimary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {quest.title}
          </Text>
          <Text style={[styles.reward, { color: quest.completed ? colors.textMuted : colors.goldText }]} numberOfLines={1}>
            +{quest.xp_reward} XP
          </Text>
        </View>
        <SegmentedBar progress={pct} segments={10} height={6} color={tint} style={{ marginTop: 8 }} />
        <Text style={[styles.caption, { color: quest.completed ? colors.success : colors.textMuted }]}>
          {quest.completed
            ? 'Concluída'
            : `${formatAmount(quest.progress)} de ${formatAmount(quest.goal_value)} ${unitLabel(quest)}`}
        </Text>
      </View>
    </View>
  );
}

interface Props {
  daily: CurrentQuest[];
  weekly: CurrentQuest[];
  completedCount: number;
  total: number;
  loading: boolean;
}

/**
 * Desafios de hoje + da semana, no Início. Some sozinho se o banco ainda não
 * rodou `quests_schema.sql` (sem catálogo, não tem o que mostrar) — em vez
 * de uma seção vazia ou quebrada.
 *
 * Recebe os dados prontos (em vez de buscar sozinho) porque o Início precisa
 * recarregar os desafios junto com o resto assim que uma atividade nova é
 * registrada — a barra tem que mexer na hora, não só na próxima vez que a
 * tela abrir.
 */
export function QuestsCard({ daily, weekly, completedCount, total, loading }: Props) {
  const { colors } = useTheme();

  if (!loading && total === 0) return null;

  return (
    <View style={{ marginTop: 30 }}>
      <SectionTitle
        title="Desafios"
        right={
          !loading ? (
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {completedCount} de {total} concluídos
            </Text>
          ) : null
        }
      />
      <Card style={styles.card}>
        {daily.length > 0 && <Text style={[styles.group, { color: colors.textMuted }]}>Hoje</Text>}
        {daily.map((q, i) => (
          <QuestRow key={q.user_quest_id} quest={q} first={i === 0} />
        ))}
        {weekly.length > 0 && (
          <>
            <Text style={[styles.group, { color: colors.textMuted, marginTop: daily.length ? 14 : 0 }]}>
              Esta semana
            </Text>
            {weekly.map((q, i) => (
              <QuestRow key={q.user_quest_id} quest={q} first={i === 0} />
            ))}
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14 },
  count: { fontSize: 13, fontWeight: '500' },
  group: { fontSize: 12.5, fontWeight: '600', marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingVertical: 12 },
  icon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  reward: { fontSize: 13, fontWeight: '700', flexShrink: 0 },
  caption: { fontSize: 12, fontWeight: '500', marginTop: 6 },
});
