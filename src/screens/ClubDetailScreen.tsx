import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useClubDetail } from '../hooks/useClubs';
import { Card } from '../components/Card';
import { TrainlyButton } from '../components/TrainlyButton';
import { CreateChallengeModal } from '../components/CreateChallengeModal';
import { formatKm } from '../lib/geo';
import { ChallengeProgress, ClubChallenge } from '../types/models';
import { RootStackParamList } from '../navigation/types';

type ClubDetailRoute = RouteProp<RootStackParamList, 'ClubDetail'>;

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
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
        <Text style={{ color: colors.textMuted }}>Clube não encontrado.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.name, { color: colors.textPrimary }]}>{club.name}</Text>
      {club.description ? <Text style={[styles.description, { color: colors.textMuted }]}>{club.description}</Text> : null}
      <Text style={[styles.memberCount, { color: colors.textMuted }]}>
        {members.length} {members.length === 1 ? 'membro' : 'membros'}
      </Text>

      {isMember && (
        <View style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.codeLabel, { color: colors.textMuted }]}>Código de convite</Text>
            <Text style={[styles.codeValue, { color: colors.textPrimary }]} selectable>
              {club.invite_code}
            </Text>
          </View>
          <Text style={[styles.codeHint, { color: colors.textMuted }]}>toque e segure para copiar</Text>
        </View>
      )}

      <View style={{ marginTop: 14 }}>
        <TrainlyButton
          title={isMember ? 'Sair do clube' : 'Entrar no clube'}
          variant={isMember ? 'secondary' : 'primary'}
          onPress={handleMembership}
          loading={membershipBusy}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Desafios</Text>
        {isAdmin && <TrainlyButton title="+ Novo" onPress={() => setModalVisible(true)} />}
      </View>

      {challenges.length === 0 && (
        <Text style={[styles.empty, { color: colors.textMuted }]}>Nenhum desafio criado ainda.</Text>
      )}

      {challenges.map((challenge) => {
        const expanded = expandedId === challenge.id;
        const board = boards[challenge.id];
        return (
          <Card key={challenge.id} style={styles.challengeCard}>
            <Pressable onPress={() => toggleChallenge(challenge)}>
              <Text style={[styles.challengeTitle, { color: colors.textPrimary }]}>{challenge.title}</Text>
              <Text style={[styles.challengeMeta, { color: colors.textMuted }]}>
                {formatDateBR(challenge.start_date)} — {formatDateBR(challenge.end_date)} · Meta: {Number(challenge.goal_km)} km
              </Text>
              {challenge.description ? (
                <Text style={[styles.challengeDesc, { color: colors.textMuted }]}>{challenge.description}</Text>
              ) : null}
            </Pressable>

            {expanded && (
              <View style={[styles.board, { borderColor: colors.border }]}>
                {boardLoading === challenge.id ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
                ) : (
                  (board ?? []).map((entry, idx) => (
                    <View key={entry.userId} style={styles.boardRow}>
                      <Text style={[styles.boardPos, { color: idx < 3 ? colors.primary : colors.textMuted }]}>
                        {idx + 1}º
                      </Text>
                      <Text style={[styles.boardName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {entry.name}
                      </Text>
                      <Text style={[styles.boardKm, { color: colors.textMuted }]}>
                        {formatKm(entry.km)}/{entry.goalKm} km
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </Card>
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
  name: { fontSize: 24, fontWeight: '900' },
  description: { fontSize: 13.5, fontWeight: '600', marginTop: 6, lineHeight: 19 },
  memberCount: { fontSize: 12.5, fontWeight: '700', marginTop: 8, textTransform: 'uppercase' },
  codeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 14 },
  codeLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  codeValue: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5, marginTop: 2 },
  codeHint: { fontSize: 10.5, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { fontSize: 13, fontWeight: '600' },
  challengeCard: { marginBottom: 12 },
  challengeTitle: { fontSize: 15, fontWeight: '800' },
  challengeMeta: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  challengeDesc: { fontSize: 12.5, fontWeight: '600', marginTop: 8, lineHeight: 17 },
  board: { borderTopWidth: 1, marginTop: 14, paddingTop: 10 },
  boardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  boardPos: { fontSize: 13, fontWeight: '900', width: 28 },
  boardName: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  boardKm: { fontSize: 12, fontWeight: '700' },
});
