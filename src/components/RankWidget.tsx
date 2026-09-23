import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { lighten } from '../theme/colors';
import { emblemFor, levelInfo } from '../lib/rank';
import { RankBadge } from './RankBadge';
import { ProgressBar } from './ProgressBar';
import { Text } from './Typography';

export function RankWidget({ xp }: { xp: number }) {
  const { colors } = useTheme();
  const info = levelInfo(xp);
  const missing = Math.max(0, info.xpToNext - info.xpIntoLevel);

  return (
    <View>
      <View style={styles.top}>
        <RankBadge icon={emblemFor(info.rank.name)} color={info.rank.color} size={50} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rankName, { color: info.rank.color }]}>Patente {info.rank.name}</Text>
          <Text style={[styles.level, { color: colors.textPrimary }]}>Nível {info.level}</Text>
        </View>
        <View style={[styles.xpPill, { backgroundColor: colors.surface }]}>
          <Text style={[styles.xpPillText, { color: colors.textPrimary }]}>{xp.toLocaleString('pt-BR')} XP</Text>
        </View>
      </View>

      <ProgressBar
        progress={info.xpToNext > 0 ? info.xpIntoLevel / info.xpToNext : 0}
        height={10}
        gradient={[lighten(info.rank.color, 0.25), info.rank.color]}
      />

      <View style={styles.captionRow}>
        <Text style={[styles.caption, { color: colors.textMuted }]}>
          {info.xpIntoLevel} / {info.xpToNext} XP
        </Text>
        <Text style={[styles.caption, { color: colors.textMuted }]}>
          faltam <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{missing} XP</Text> pro nível {info.level + 1}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  rankName: { fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  level: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 1 },
  xpPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  xpPillText: { fontSize: 12, fontWeight: '700' },
  captionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9, gap: 8 },
  caption: { fontSize: 12, fontWeight: '600' },
});
