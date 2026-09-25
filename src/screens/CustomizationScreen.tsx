import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { levelInfo } from '../lib/rank';
import { RANKS } from '../theme/colors';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { SectionTitle } from '../components/SectionTitle';
import { FadeIn, PressableScale } from '../components/Motion';
import { Text } from '../components/Typography';
import { tapLight } from '../lib/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Kind = 'frame' | 'map';

// Tela de "vestiário": escolher qual moldura de avatar e qual cor de mapa
// usar, entre as patentes já desbloqueadas — pode ser diferente da patente
// atual (ex: já é Diamante mas prefere usar a moldura Ouro). "Automático"
// sempre acompanha a patente atual, mesmo quando ela sobe.
export function CustomizationScreen() {
  const { colors } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const { level, rank: currentRank } = levelInfo(profile.xp);

  const equip = async (kind: Kind, tierName: string | null) => {
    setBusy(true);
    tapLight();
    const column = kind === 'frame' ? 'equipped_frame_tier' : 'equipped_map_tier';
    const { error } = await supabase.from('profiles').update({ [column]: tierName }).eq('id', profile.id);
    setBusy(false);
    if (error) {
      Alert.alert('Trainly', 'Não foi possível salvar — tente de novo.');
      return;
    }
    await refreshProfile();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <FadeIn>
        <SectionTitle title="Moldura do avatar" />
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Desbloqueada ao alcançar cada patente. Pode usar uma diferente da sua patente atual, se preferir.
        </Text>
        <View style={styles.grid}>
          <TierTile
            label="Automático"
            hint={`Segue sua patente (${currentRank.name})`}
            locked={false}
            active={!profile.equipped_frame_tier}
            disabled={busy}
            onPress={() => equip('frame', null)}
          >
            <Avatar name={profile.name} size={52} uri={profile.avatar_url} frameTier={currentRank.name} />
          </TierTile>
          {RANKS.map((r) => (
            <TierTile
              key={r.name}
              label={r.name}
              hint={`Nível ${r.min}`}
              locked={level < r.min}
              active={profile.equipped_frame_tier === r.name}
              disabled={busy}
              onPress={() => equip('frame', r.name)}
            >
              <Avatar name={profile.name} size={52} uri={profile.avatar_url} frameTier={r.name} />
            </TierTile>
          ))}
        </View>
      </FadeIn>

      <FadeIn delay={80} style={{ marginTop: 28 }}>
        <SectionTitle title="Cor do mapa" />
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Vale no traçado da sua corrida ao vivo. Numa rota publicada, o mapa sempre mostra a cor de quem a criou.
        </Text>
        <View style={styles.grid}>
          <TierTile
            label="Automático"
            hint={`Segue sua patente (${currentRank.name})`}
            locked={false}
            active={!profile.equipped_map_tier}
            disabled={busy}
            onPress={() => equip('map', null)}
          >
            <View style={[styles.swatch, { backgroundColor: currentRank.color }]} />
          </TierTile>
          {RANKS.map((r) => (
            <TierTile
              key={r.name}
              label={r.name}
              hint={`Nível ${r.min}`}
              locked={level < r.min}
              active={profile.equipped_map_tier === r.name}
              disabled={busy}
              onPress={() => equip('map', r.name)}
            >
              <View style={[styles.swatch, { backgroundColor: r.color }]} />
            </TierTile>
          ))}
        </View>
      </FadeIn>
    </ScrollView>
  );
}

interface TierTileProps {
  label: string;
  hint: string;
  locked: boolean;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

function TierTile({ label, hint, locked, active, disabled, onPress, children }: TierTileProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      style={styles.tileWrap}
      disabled={locked || disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label}, ainda trancado` : `Usar ${label}`}
    >
      <Card
        style={[
          styles.tile,
          { borderColor: active ? colors.primary : colors.border },
          active && { borderWidth: 2 },
          locked && styles.tileLocked,
        ]}
      >
        {active && (
          <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        )}
        <View style={locked && styles.dimmed}>{children}</View>
        <Text style={[styles.tileLabel, { color: colors.textPrimary }, locked && { color: colors.textMuted }]}>{label}</Text>
        <View style={styles.tileHintRow}>
          {locked && <Ionicons name="lock-closed" size={10} color={colors.textMuted} style={{ marginRight: 3 }} />}
          <Text style={[styles.tileHint, { color: colors.textMuted }]}>{hint}</Text>
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  hint: { fontSize: 12.5, fontWeight: '500', lineHeight: 17, marginTop: -6, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { flexBasis: '30%', flexGrow: 1 },
  tile: { alignItems: 'center', padding: 12, position: 'relative' },
  tileLocked: { opacity: 0.55 },
  dimmed: { opacity: 0.8 },
  swatch: { width: 52, height: 52, borderRadius: 16 },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 12, fontWeight: '800', marginTop: 8 },
  tileHintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  tileHint: { fontSize: 10, fontWeight: '600' },
});
