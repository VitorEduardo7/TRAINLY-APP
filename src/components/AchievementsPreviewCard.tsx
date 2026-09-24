import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAchievements } from '../hooks/useAchievements';
import { Card } from './Card';
import { SectionTitle } from './SectionTitle';
import { PressableScale } from './Motion';
import { Text } from './Typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

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

  const preview = achievements.slice(0, 6);

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
            <View key={a.id} style={[styles.icon, { backgroundColor: a.unlocked ? colors.primarySoft : colors.surface }]}>
              <Ionicons
                name={(a.unlocked ? a.icon : 'lock-closed') as IconName}
                size={17}
                color={a.unlocked ? colors.primary : colors.textMuted}
              />
            </View>
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
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chevron: { marginLeft: 'auto', paddingLeft: 4 },
});
