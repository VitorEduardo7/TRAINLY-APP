import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAchievements } from '../hooks/useAchievements';
import { Card } from './Card';
import { SectionTitle } from './SectionTitle';
import { PressableScale } from './Motion';
import { Text } from './Typography';
import { AchievementBadge } from './AchievementBadge';
import { progressRatio } from '../lib/achievements';

interface Props {
  userId: string | undefined;
  onPress: () => void;
}

/**
 * Prévia de conquistas dentro do card de perfil: contagem "X/Y" e um carrossel
 * curto dos ícones (desbloqueados coloridos, o resto com cadeado). Um toque
 * abre a lista completa em `AchievementsScreen`.
 */
export function AchievementsPreviewCard({ userId, onPress }: Props) {
  const { colors } = useTheme();
  const { achievements, unlockedCount, total, loading } = useAchievements(userId);

  // Sem conquistas cadastradas ainda (banco não migrado) — não mostra nada em
  // vez de um card vazio ou quebrado.
  if (!loading && total === 0) return null;

  // Primeiro as últimas que a pessoa ganhou; depois as mais perto de sair.
  const unlocked = achievements
    .filter((a) => a.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''));
  const next = achievements
    .filter((a) => !a.unlocked && !a.secret)
    .sort((a, b) => (progressRatio(b, b.current) ?? 0) - (progressRatio(a, a.current) ?? 0));
  const preview = [...unlocked, ...next].slice(0, 6);

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Ver todas as conquistas">
      <Card>
        <SectionTitle
          title="Conquistas"
          right={
            !loading ? <Text style={[styles.count, { color: colors.textMuted }]}>{unlockedCount}/{total}</Text> : null
          }
        />
        <View style={styles.row}>
          {preview.map((a) => (
            <AchievementBadge key={a.id} icon={a.icon} tier={a.tier} unlocked={a.unlocked} size={36} />
          ))}
          <View style={styles.chevron}>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chevron: { marginLeft: 'auto', paddingLeft: 4 },
});
