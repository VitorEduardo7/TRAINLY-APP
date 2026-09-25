import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { effectiveTier } from '../lib/rank';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { SectionTitle } from './SectionTitle';
import { PressableScale } from './Motion';
import { Text } from './Typography';
import type { Profile } from '../types/models';

interface Props {
  profile: Profile | null | undefined;
  onPress: () => void;
}

/**
 * Prévia da personalização no Perfil: moldura equipada + cor do mapa
 * equipada, lado a lado. Um toque abre `CustomizationScreen`, onde dá pra
 * trocar pra qualquer patente já desbloqueada — não precisa ser a atual.
 */
export function CustomizationPreviewCard({ profile, onPress }: Props) {
  const { colors } = useTheme();
  if (!profile) return null;

  const frame = effectiveTier(profile.xp, profile.equipped_frame_tier);
  const map = effectiveTier(profile.xp, profile.equipped_map_tier);

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Personalizar moldura e cor do mapa">
      <Card>
        <SectionTitle title="Personalização" />
        <View style={styles.row}>
          <View style={styles.item}>
            <Avatar name={profile.name} size={38} uri={profile.avatar_url} frameTier={frame.name} />
            <View>
              <Text style={[styles.label, { color: colors.textMuted }]}>Moldura</Text>
              <Text style={[styles.value, { color: colors.textPrimary }]}>{frame.name}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: map.color }]} />
            <View>
              <Text style={[styles.label, { color: colors.textMuted }]}>Cor do mapa</Text>
              <Text style={[styles.value, { color: colors.textPrimary }]}>{map.name}</Text>
            </View>
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { width: 1, alignSelf: 'stretch', marginVertical: 2, marginHorizontal: 10 },
  swatch: { width: 38, height: 38, borderRadius: 12 },
  label: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 13.5, fontWeight: '800', marginTop: 2 },
});
