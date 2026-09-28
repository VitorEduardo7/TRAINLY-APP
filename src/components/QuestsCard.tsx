import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { Card } from './Card';
import { SectionTitle } from './SectionTitle';
import { ProgressBar } from './ProgressBar';
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

function QuestRow({ quest }: { quest: CurrentQuest }) {
  const { colors } = useTheme();
  const pct = quest.goal_value > 0 ? Math.min(1, quest.progress / quest.goal_value) : 0;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: quest.completed ? withAlpha(colors.success, 0.16) : colors.surface },
        ]}
      >
        <Ionicons
          name={(quest.completed ? 'checkmark' : quest.icon) as IconName}
          size={16}
          color={quest.completed ? colors.success : colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary },
            quest.completed && { color: colors.textMuted, textDecorationLine: 'line-through' },
          ]}
          numberOfLines={1}
        >
          {quest.title}
        </Text>
        {quest.completed ? (
          <Text style={[styles.caption, { color: colors.success }]}>Concluído</Text>
        ) : (
          <>
            <ProgressBar progress={pct} height={5} style={{ marginTop: 6, marginBottom: 4 }} />
            <Text style={[styles.caption, { color: colors.textMuted }]}>
              {formatAmount(quest.progress)}/{formatAmount(quest.goal_value)} {unitLabel(quest)}
            </Text>
          </>
        )}
      </View>
      <View style={[styles.xpPill, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.xpText, { color: colors.primary }]}>+{quest.xp_reward}</Text>
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
 * Desafios de hoje + da semana, no Dashboard. Some sozinho se o banco ainda
 * não rodou `quests_schema.sql` (sem catálogo, não tem o que mostrar) — em
 * vez de um card vazio ou quebrado.
 *
 * Recebe os dados prontos (em vez de buscar sozinho) porque o Dashboard
 * precisa recarregar os desafios junto com o resto assim que uma atividade
 * nova é registrada — a barra de progresso tem que mexer na hora, não só na
 * próxima vez que a tela abrir.
 */
export function QuestsCard({ daily, weekly, completedCount, total, loading }: Props) {
  const { colors } = useTheme();

  if (!loading && total === 0) return null;

  return (
    <Card style={{ marginTop: 14 }}>
      <SectionTitle
        title="Desafios"
        right={
          !loading ? (
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {completedCount}/{total}
            </Text>
          ) : null
        }
      />
      {daily.map((q) => (
        <QuestRow key={q.user_quest_id} quest={q} />
      ))}
      {weekly.length > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.weeklyLabel, { color: colors.textMuted }]}>Esta semana</Text>
          {weekly.map((q) => (
            <QuestRow key={q.user_quest_id} quest={q} />
          ))}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  iconCircle: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13.5, fontWeight: '700' },
  caption: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  xpPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  xpText: { fontSize: 11, fontWeight: '800' },
  divider: { height: 1, marginVertical: 6 },
  weeklyLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
});
