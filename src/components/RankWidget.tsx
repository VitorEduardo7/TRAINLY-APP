import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { levelInfo } from '../lib/rank';

export function RankWidget({ xp }: { xp: number }) {
  const { colors } = useTheme();
  const info = levelInfo(xp);

  return (
    <View>
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: info.rank.color }]}>
          <Text style={styles.badgeText}>{info.rank.name}</Text>
        </View>
        <Text style={[styles.level, { color: colors.textPrimary }]}>Nível {info.level}</Text>
      </View>

      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.barFill,
            { width: `${info.progressPct}%`, backgroundColor: info.rank.color },
          ]}
        />
      </View>

      <Text style={[styles.caption, { color: colors.textMuted }]}>
        {info.xpIntoLevel} / {info.xpToNext} XP para o próximo nível
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  level: { fontWeight: '700', fontSize: 14 },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  caption: { fontSize: 12, marginTop: 8, fontWeight: '600' },
});
