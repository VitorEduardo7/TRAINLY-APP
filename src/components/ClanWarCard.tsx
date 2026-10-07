import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useClanWar, useClanWarMembers } from '../hooks/useClanWar';
import { formatDateShort, isWarDay, nextWarStart } from '../lib/clanWar';
import { Card } from './Card';
import { SectionTitle } from './SectionTitle';
import { PressableScale } from './Motion';
import { Text } from './Typography';
import { tapLight } from '../lib/haptics';
import { RootStackParamList } from '../navigation/types';

interface Props {
  clubId: string;
}

/**
 * Resumo da Guerra de Clã dentro do clube: posição no ranking geral, XP
 * somado e quem mais contribuiu, com atalho pro ranking completo. Fica
 * sempre visível (mesmo com 0 pontos) — é também como a pessoa descobre que
 * a guerra existe e quando é a próxima, sem precisar já ter participado.
 */
export function ClanWarCard({ clubId }: Props) {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { clubs, loading: leaderboardLoading } = useClanWar();
  const { members, loading: membersLoading } = useClanWarMembers(clubId);

  const rankIndex = clubs.findIndex((c) => c.club_id === clubId);
  const mine = rankIndex >= 0 ? clubs[rankIndex] : null;
  const topContributors = useMemo(() => members.filter((m) => m.war_xp > 0).slice(0, 3), [members]);

  const loading = leaderboardLoading || membersLoading;
  const active = isWarDay();

  return (
    <Card style={{ marginTop: 14 }}>
      <SectionTitle
        title="Guerra de Clã"
        right={
          active ? (
            <View style={[styles.statusPill, { backgroundColor: withAlpha(colors.danger, 0.14) }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.danger }]} />
              <Text style={[styles.statusText, { color: colors.danger }]}>ao vivo</Text>
            </View>
          ) : undefined
        }
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 10 }} />
      ) : (
        <>
          <View style={styles.rankRow}>
            <View style={[styles.rankBadge, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.rankNumber, { color: colors.primary }]}>{rankIndex >= 0 ? `#${rankIndex + 1}` : '—'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rankLabel, { color: colors.textMuted }]}>
                {rankIndex >= 0
                  ? `de ${clubs.length} ${clubs.length === 1 ? 'clube pontuando' : 'clubes pontuando'}`
                  : active
                  ? 'ninguém pontuou ainda'
                  : `próxima guerra sáb, ${formatDateShort(nextWarStart())}`}
              </Text>
              <Text style={[styles.rankXp, { color: colors.textPrimary }]}>{mine?.war_xp ?? 0} XP na guerra</Text>
            </View>
          </View>

          {topContributors.length > 0 && (
            <View style={styles.contributors}>
              {topContributors.map((m, idx) => (
                <View key={m.user_id} style={styles.contributorRow}>
                  <Text style={[styles.contributorPos, { color: colors.textMuted }]}>{idx + 1}º</Text>
                  <Text style={[styles.contributorName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={[styles.contributorXp, { color: colors.goldText }]}>{m.war_xp} XP</Text>
                </View>
              ))}
            </View>
          )}

          <PressableScale
            onPress={() => {
              tapLight();
              navigation.navigate('ClanWar');
            }}
            style={[styles.cta, { borderColor: colors.border }]}
          >
            <Text style={[styles.ctaText, { color: colors.primary }]}>Ver ranking geral</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </PressableScale>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '800' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankBadge: { minWidth: 44, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  rankNumber: { fontSize: 15, fontWeight: '800' },
  rankLabel: { fontSize: 11, fontWeight: '600' },
  rankXp: { fontSize: 15.5, fontWeight: '800', marginTop: 2 },
  contributors: { marginTop: 12, gap: 6 },
  contributorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contributorPos: { fontSize: 11.5, fontWeight: '700', width: 20 },
  contributorName: { flex: 1, fontSize: 12.5, fontWeight: '700' },
  contributorXp: { fontSize: 11.5, fontWeight: '800' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  ctaText: { fontSize: 12.5, fontWeight: '700' },
});
