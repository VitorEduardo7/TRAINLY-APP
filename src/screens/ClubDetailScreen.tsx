import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_WASH, withAlpha } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useClubDetail } from '../hooks/useClubs';
import { Card } from '../components/Card';
import { TrainlyButton } from '../components/TrainlyButton';
import { CreateChallengeModal } from '../components/CreateChallengeModal';
import { SectionTitle } from '../components/SectionTitle';
import { ProgressBar } from '../components/ProgressBar';
import { EmptyState } from '../components/EmptyState';
import { FadeIn } from '../components/Motion';
import { Text } from '../components/Typography';
import { selection, warning } from '../lib/haptics';
import { formatKm } from '../lib/geo';
import { ChallengeProgress, ClubChallenge } from '../types/models';
import { RootStackParamList } from '../navigation/types';

type ClubDetailRoute = RouteProp<RootStackParamList, 'ClubDetail'>;

// Ouro, prata e bronze pro pódio do ranking (mesmas cores das patentes).
const PODIUM = ['#d4a017', '#8a94a6', '#a5672f'];

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Desafio em andamento, ainda não começou ou já terminou (pela data de hoje). */
function challengeStatus(c: ClubChallenge): 'ativo' | 'em breve' | 'encerrado' {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (today < c.start_date) return 'em breve';
  if (today > c.end_date) return 'encerrado';
  return 'ativo';
}

export function ClubDetailScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { params } = useRoute<ClubDetailRoute>();
  const {
    club,
    members,
    challenges,
    loading,
    isMember,
    isAdmin,
    reload,
    joinThisClub,
    leaveThisClub,
    createChallenge,
    getLeaderboard,
  } = useClubDetail(params.clubId, profile?.id);

  const [modalVisible, setModalVisible] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [boards, setBoards] = useState<Record<string, ChallengeProgress[]>>({});
  const [boardLoading, setBoardLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      reload();
      // zera o cache do ranking dos desafios — sem isso, reabrir um desafio
      // já expandido antes mostrava o placar de quando a tela carregou pela
      // última vez, ignorando atividades novas registradas nesse meio-tempo.
      setBoards({});
      setExpandedId(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload]),
  );

  const toggleChallenge = async (challenge: ClubChallenge) => {
    selection();
    if (expandedId === challenge.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(challenge.id);
    if (!boards[challenge.id]) {
      setBoardLoading(challenge.id);
      const board = await getLeaderboard(challenge);
      setBoards((prev) => ({ ...prev, [challenge.id]: board }));
      setBoardLoading(null);
    }
  };

  const doMembershipAction = async () => {
    setMembershipBusy(true);
    try {
      if (isMember) await leaveThisClub();
      else await joinThisClub();
    } finally {
      setMembershipBusy(false);
    }
  };

  const handleMembership = () => {
    if (!isMember) {
      doMembershipAction();
      return;
    }
    warning();
    Alert.alert('Trainly', 'Tem certeza que quer sair desse clube?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: doMembershipAction },
    ]);
  };

  if (loading && !club) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!club) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle-outline" title="Clube não encontrado" message="Ele pode ter sido apagado." />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <FadeIn>
        <Card accent={SCREEN_WASH.clubs} style={styles.heroCard}>
          <LinearGradient
            colors={[withAlpha(SCREEN_WASH.clubs[0], 0.14), 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroTop}>
            <LinearGradient colors={SCREEN_WASH.clubs} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
              <Ionicons name="trophy" size={26} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]}>{club.name}</Text>
              <View style={styles.memberRow}>
                <Ionicons name="people" size={14} color={colors.textMuted} />
                <Text style={[styles.memberCount, { color: colors.textMuted }]}>
                  {members.length} {members.length === 1 ? 'membro' : 'membros'}
                  {isAdmin ? ' · você é admin' : ''}
                </Text>
              </View>
            </View>
          </View>
          {club.description ? <Text style={[styles.description, { color: colors.textMuted }]}>{club.description}</Text> : null}

          {isMember && (
            <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="ticket-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.codeLabel, { color: colors.textMuted }]}>Código de convite</Text>
                <Text style={[styles.codeValue, { color: colors.textPrimary }]} selectable>
                  {club.invite_code}
                </Text>
              </View>
              <Text style={[styles.codeHint, { color: colors.textMuted }]}>toque e segure{'\n'}para copiar</Text>
            </View>
          )}

          <View style={{ marginTop: 14 }}>
            <TrainlyButton
              title={isMember ? 'Sair do clube' : 'Entrar no clube'}
              icon={isMember ? 'exit-outline' : 'enter-outline'}
              variant={isMember ? 'secondary' : 'primary'}
              onPress={handleMembership}
              loading={membershipBusy}
            />
          </View>
        </Card>
      </FadeIn>

      <SectionTitle
        title="Desafios"
        style={{ marginTop: 26 }}
        right={isAdmin ? <TrainlyButton size="sm" title="Novo" icon="add" onPress={() => setModalVisible(true)} /> : undefined}
      />

      {challenges.length === 0 && (
        <EmptyState
          compact
          icon="flag-outline"
          title="Nenhum desafio criado ainda"
          message={isAdmin ? 'Crie o primeiro com uma meta de km e um período.' : 'Quando o admin criar um, ele aparece aqui.'}
        />
      )}

      {challenges.map((challenge, i) => {
        const expanded = expandedId === challenge.id;
        const board = boards[challenge.id];
        const status = challengeStatus(challenge);
        const statusColor =
          status === 'ativo' ? colors.success : status === 'em breve' ? colors.warning : colors.textMuted;
        return (
          <FadeIn key={challenge.id} delay={Math.min(i, 4) * 60}>
            <Card style={styles.challengeCard}>
              <Pressable onPress={() => toggleChallenge(challenge)}>
                <View style={styles.challengeTop}>
                  <View style={[styles.flagIcon, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name="flag" size={17} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.challengeTitle, { color: colors.textPrimary }]}>{challenge.title}</Text>
                    <View style={[styles.statusPill, { backgroundColor: colors.surface }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
                    </View>
                  </View>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </View>

                <View style={styles.challengeMetaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.challengeMeta, { color: colors.textMuted }]}>
                      {formatDateBR(challenge.start_date)} — {formatDateBR(challenge.end_date)}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.challengeMeta, { color: colors.textMuted }]}>
                      Meta: <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>{Number(challenge.goal_km)} km</Text>
                    </Text>
                  </View>
                </View>

                {challenge.description ? (
                  <Text style={[styles.challengeDesc, { color: colors.textMuted }]}>{challenge.description}</Text>
                ) : null}
              </Pressable>

              {expanded && (
                <FadeIn offset={6} duration={260} style={[styles.board, { borderColor: colors.border }]}>
                  {boardLoading === challenge.id ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
                  ) : (board ?? []).length === 0 ? (
                    <Text style={[styles.challengeMeta, { color: colors.textMuted, paddingVertical: 8 }]}>
                      Ninguém registrou atividade no período ainda.
                    </Text>
                  ) : (
                    (board ?? []).map((entry, idx) => {
                      const podium = idx < 3 ? PODIUM[idx] : null;
                      const done = entry.km >= entry.goalKm;
                      return (
                        <View key={entry.userId} style={styles.boardRow}>
                          <View
                            style={[
                              styles.boardPos,
                              { backgroundColor: podium ? podium : colors.surface },
                            ]}
                          >
                            {podium ? (
                              <Ionicons name="medal" size={14} color="#fff" />
                            ) : (
                              <Text style={[styles.boardPosText, { color: colors.textMuted }]}>{idx + 1}</Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.boardNameRow}>
                              <Text style={[styles.boardName, { color: colors.textPrimary }]} numberOfLines={1}>
                                {entry.name}
                              </Text>
                              <Text style={[styles.boardKm, { color: done ? colors.success : colors.textMuted }]}>
                                {formatKm(entry.km)}/{entry.goalKm} km
                              </Text>
                            </View>
                            <ProgressBar
                              progress={entry.goalKm > 0 ? entry.km / entry.goalKm : 0}
                              height={6}
                              color={done ? colors.success : podium ?? colors.primary}
                              delay={idx * 60}
                              style={{ marginTop: 6 }}
                            />
                          </View>
                        </View>
                      );
                    })
                  )}
                </FadeIn>
              )}
            </Card>
          </FadeIn>
        );
      })}

      <CreateChallengeModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={(input) => createChallenge(input)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  heroCard: { overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 56, height: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  memberCount: { fontSize: 12.5, fontWeight: '700' },
  description: { fontSize: 13.5, fontWeight: '500', marginTop: 14, lineHeight: 19 },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  codeLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  codeValue: { fontSize: 19, fontWeight: '800', letterSpacing: 2, marginTop: 2 },
  codeHint: { fontSize: 10.5, fontWeight: '600', textAlign: 'right' },
  challengeCard: { marginBottom: 12 },
  challengeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flagIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  challengeTitle: { fontSize: 15, fontWeight: '800' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  challengeMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  challengeMeta: { fontSize: 12, fontWeight: '600' },
  challengeDesc: { fontSize: 12.5, fontWeight: '500', marginTop: 10, lineHeight: 18 },
  board: { borderTopWidth: 1, marginTop: 14, paddingTop: 12, gap: 12 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boardPos: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  boardPosText: { fontSize: 12.5, fontWeight: '800' },
  boardNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  boardName: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  boardKm: { fontSize: 12, fontWeight: '700' },
});
