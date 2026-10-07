import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { emblemFor, levelInfo } from '../lib/rank';
import { RankBadge } from './RankBadge';
import { SegmentedBar } from './SegmentedBar';
import { Text } from './Typography';

/**
 * Patente + nível + barra de XP em parciais. O XP é sempre DOURADO (a
 * "medalha" do app, mesma cor em todo lugar); a cor da patente fica no
 * emblema e no nome.
 */
export function RankWidget({ xp }: { xp: number }) {
  const { colors, colorBlindMode } = useTheme();
  const info = levelInfo(xp, colorBlindMode);
  const missing = Math.max(0, info.xpToNext - info.xpIntoLevel);

  return (
    <View>
      <View style={styles.top}>
        <RankBadge icon={emblemFor(info.rank.name)} color={info.rank.color} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rankName, { color: colors.textMuted }]}>
            Patente <Text style={{ color: info.rank.color, fontWeight: '600' }}>{info.rank.name}</Text>
          </Text>
          <Text style={[styles.level, { color: colors.textPrimary }]}>Nível {info.level}</Text>
        </View>
        <View style={styles.xpCol}>
          <Text style={[styles.xpTotal, { color: colors.goldText }]}>{xp.toLocaleString('pt-BR')}</Text>
          <Text style={[styles.xpLabel, { color: colors.textMuted }]}>XP total</Text>
        </View>
      </View>

      <SegmentedBar
        progress={info.xpToNext > 0 ? info.xpIntoLevel / info.xpToNext : 0}
        segments={14}
        height={9}
        color={colors.gold}
      />

      <View style={styles.captionRow}>
        <Text style={[styles.caption, { color: colors.textMuted }]}>
          {info.xpIntoLevel} de {info.xpToNext} XP
        </Text>
        <Text style={[styles.caption, { color: colors.textMuted }]}>
          faltam <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{missing}</Text> pro nível {info.level + 1}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  rankName: { fontSize: 13, fontWeight: '500' },
  level: { fontSize: 32, fontWeight: '900', fontStyle: 'italic', lineHeight: 36 },
  xpCol: { alignItems: 'flex-end' },
  xpTotal: { fontSize: 24, fontWeight: '900', fontStyle: 'italic', lineHeight: 28 },
  xpLabel: { fontSize: 11.5, fontWeight: '500' },
  captionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9, gap: 8 },
  caption: { fontSize: 12.5, fontWeight: '500' },
});
