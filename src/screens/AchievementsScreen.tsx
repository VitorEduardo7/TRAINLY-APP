import React, { useLayoutEffect } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useAchievements } from '../hooks/useAchievements';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FadeIn } from '../components/Motion';
import { Text } from '../components/Typography';
import { RootStackParamList } from '../navigation/types';

type AchievementsRouteProp = RouteProp<RootStackParamList, 'Achievements'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Grade com todas as conquistas (desbloqueadas e ainda por vir) de um
// usuário — a própria ou de outra pessoa (aberta a partir do perfil dela).
// A descrição de uma conquista trancada fica visível de propósito: funciona
// como uma meta a perseguir, não como uma surpresa escondida.
export function AchievementsScreen() {
  const { colors } = useTheme();
  const { params } = useRoute<AchievementsRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { achievements, unlockedCount, total, loading, error, reload } = useAchievements(params.userId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: params.name ? `Conquistas de ${params.name.split(' ')[0]}` : 'Conquistas' });
  }, [navigation, params.name]);

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
      <FadeIn style={styles.summary}>
        <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
          {unlockedCount}/{total}
        </Text>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>conquistas desbloqueadas</Text>
      </FadeIn>

      <View style={styles.grid}>
        {achievements.map((a, i) => (
          <FadeIn key={a.id} delay={Math.min(i, 8) * 40} style={styles.cardWrap}>
            <Card style={[styles.card, !a.unlocked && styles.cardLocked] as any}>
              <View
                style={[styles.icon, { backgroundColor: a.unlocked ? withAlpha(colors.primary, 0.16) : colors.surface }]}
              >
                <Ionicons
                  name={(a.unlocked ? a.icon : 'lock-closed') as IconName}
                  size={20}
                  color={a.unlocked ? colors.primary : colors.textMuted}
                />
              </View>
              <Text style={[styles.title, { color: a.unlocked ? colors.textPrimary : colors.textMuted }]}>{a.title}</Text>
              <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={3}>
                {a.description}
              </Text>
              <View style={styles.footer}>
                <View style={[styles.xpPill, { backgroundColor: colors.surface }]}>
                  <Ionicons name="star" size={11} color={colors.warning} />
                  <Text style={[styles.xpText, { color: colors.textMuted }]}>+{a.xp_reward} XP</Text>
                </View>
                {a.unlocked && a.unlockedAt ? (
                  <Text style={[styles.unlockedDate, { color: colors.textMuted }]}>
                    {new Date(a.unlockedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </Text>
                ) : null}
              </View>
            </Card>
          </FadeIn>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 40 },
  summary: { alignItems: 'center', marginBottom: 20 },
  summaryValue: { fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
  summaryLabel: { fontSize: 12.5, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardWrap: { flexBasis: '47%', flexGrow: 1 },
  card: { alignItems: 'flex-start', minHeight: 152 },
  cardLocked: { opacity: 0.6 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { fontSize: 13.5, fontWeight: '800', marginBottom: 4 },
  description: { fontSize: 11.5, fontWeight: '500', lineHeight: 15.5 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, alignSelf: 'stretch' },
  xpPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  xpText: { fontSize: 10, fontWeight: '800' },
  unlockedDate: { fontSize: 10, fontWeight: '700' },
});
