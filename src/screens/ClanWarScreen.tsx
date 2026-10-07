import React, { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_WASH, withAlpha } from '../theme/colors';
import { useClanWar } from '../hooks/useClanWar';
import { formatDateShort, isWarDay, nextWarStart, warSaturdayOf, WAR_XP_CAP_PER_DAY } from '../lib/clanWar';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FadeIn } from '../components/Motion';
import { Text } from '../components/Typography';

// Mesmas cores do pódio dos desafios de clube (ClubDetailScreen) — ouro,
// prata e bronze pros 3 primeiros do ranking geral.
const PODIUM = ['#d4a017', '#8a94a6', '#a5672f'];

/**
 * Ranking geral da Guerra de Clã: todo sábado+domingo, o XP de cada atleta
 * (com teto diário) soma pro clube dele. Tela só de leitura — quem quiser
 * "jogar" a guerra só precisa treinar normalmente no fim de semana, nenhuma
 * rota fixa ou ação extra é exigida (por isso "rotas livres" no roteiro).
 */
export function ClanWarScreen() {
  const { colors } = useTheme();
  const { clubs, loading, error, reload } = useClanWar();
  const active = isWarDay();

  const windowLabel = useMemo(() => {
    if (active) {
      const sat = warSaturdayOf();
      const sun = new Date(sat);
      sun.setDate(sun.getDate() + 1);
      return `Guerra atual: ${formatDateShort(sat)} — ${formatDateShort(sun)}, termina à meia-noite de domingo`;
    }
    return `Próxima guerra: sábado, ${formatDateShort(nextWarStart())}`;
  }, [active]);

  const firstLoad = loading && clubs.length === 0 && !error;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
    >
      <FadeIn>
        <Card accent={SCREEN_WASH.clanWar} style={styles.heroCard}>
          <LinearGradient
            colors={[withAlpha(SCREEN_WASH.clanWar[0], 0.14), 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroTop}>
            <LinearGradient colors={SCREEN_WASH.clanWar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
              <Ionicons name="flag" size={24} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Guerra de Clã</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: active ? colors.danger : colors.textMuted }]} />
                <Text style={[styles.statusLabel, { color: active ? colors.danger : colors.textMuted }]}>
                  {active ? 'ao vivo' : 'entre guerras'}
                </Text>
              </View>
            </View>
          </View>
          <Text style={[styles.windowLabel, { color: colors.textMuted }]}>{windowLabel}</Text>
          <Text style={[styles.explainer, { color: colors.textMuted }]}>
            Toda atividade registrada no sábado ou domingo conta pro seu clube — sem rota fixa, é só treinar normal. Cada
            atleta soma no máximo {WAR_XP_CAP_PER_DAY} XP por dia pra guerra, pra manter a disputa justa entre clubes de
            tamanhos diferentes.
          </Text>
        </Card>
      </FadeIn>

      {firstLoad && (
        <View style={{ paddingVertical: 30, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!firstLoad && clubs.length === 0 && (
        <EmptyState
          icon={error ? 'cloud-offline-outline' : 'flag-outline'}
          title={error ? 'Não foi possível carregar' : 'Nenhum clube pontuou ainda'}
          message={
            error
              ? 'Puxe a tela pra baixo pra tentar de novo.'
              : active
              ? 'As atividades do fim de semana ainda não apareceram no placar — treine e volte aqui.'
              : 'Volte no sábado ou domingo pra ver o ranking em ação.'
          }
        />
      )}

      {clubs.map((c, idx) => {
        const podium = idx < 3 ? PODIUM[idx] : null;
        return (
          <FadeIn key={c.club_id} delay={Math.min(idx, 6) * 60}>
            <Card style={styles.row}>
              <View style={[styles.pos, { backgroundColor: podium ?? colors.surface }]}>
                {podium ? (
                  <Ionicons name="trophy" size={15} color="#fff" />
                ) : (
                  <Text style={[styles.posText, { color: colors.textMuted }]}>{idx + 1}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clubName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {c.club_name}
                </Text>
                <Text style={[styles.memberCount, { color: colors.textMuted }]}>
                  {c.member_count} {c.member_count === 1 ? 'atleta pontuando' : 'atletas pontuando'}
                </Text>
              </View>
              <Text style={[styles.xp, { color: colors.goldText }]}>{c.war_xp} XP</Text>
            </Card>
          </FadeIn>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  heroCard: { overflow: 'hidden', marginBottom: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusLabel: { fontSize: 13.5, fontWeight: '800' },
  windowLabel: { fontSize: 12.5, fontWeight: '700', marginTop: 14 },
  explainer: { fontSize: 12.5, fontWeight: '500', marginTop: 8, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  pos: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  posText: { fontSize: 13, fontWeight: '800' },
  clubName: { fontSize: 15, fontWeight: '800' },
  memberCount: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  xp: { fontSize: 15, fontWeight: '800' },
});
