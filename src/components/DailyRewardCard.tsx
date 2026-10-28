import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { success, tapLight } from '../lib/haptics';
import { todayInBrasilia } from '../lib/time';
import { Profile } from '../types/models';
import { Card } from './Card';
import { TrainlyButton } from './TrainlyButton';
import { Text } from './Typography';

export const DAILY_REWARD_XP = 20;

interface Props {
  profile: Profile;
  /** Recarrega o perfil depois de resgatar (XP novo e data do resgate). */
  onClaimed: () => Promise<void> | void;
}

/**
 * Recompensa diária — igual ao site: +20 XP uma vez por dia. Quem decide se
 * já foi resgatada hoje é o banco (função `claim_daily_reward`, dia de
 * Brasília), então resgatar no site também trava o botão aqui e vice-versa.
 */
export function DailyRewardCard({ profile, onClaimed }: Props) {
  const { colors } = useTheme();
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const claimed = justClaimed || profile.last_daily_reward === todayInBrasilia();

  const claim = async () => {
    tapLight();
    setClaiming(true);
    try {
      const { error } = await supabase.rpc('claim_daily_reward');
      if (error && !/already_claimed/.test(error.message)) throw error;
      setJustClaimed(true);
      if (!error) success();
      await onClaimed();
      if (error) Alert.alert('Trainly', 'A recompensa de hoje já foi resgatada. Volte amanhã!');
    } catch (err: any) {
      Alert.alert('Trainly', err?.message ?? 'Não foi possível resgatar agora.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={[styles.icon, { backgroundColor: withAlpha(colors.gold, claimed ? 0.08 : 0.16) }]}>
        <Ionicons name={claimed ? 'checkmark' : 'gift'} size={20} color={claimed ? colors.textMuted : colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Recompensa diária</Text>
        <Text style={[styles.caption, { color: colors.textMuted }]}>
          {claimed ? 'Resgatada hoje — volte amanhã.' : `+${DAILY_REWARD_XP} XP só por abrir o app hoje.`}
        </Text>
      </View>
      <TrainlyButton
        size="sm"
        variant={claimed ? 'secondary' : 'gold'}
        title={claimed ? 'Resgatado' : `+${DAILY_REWARD_XP} XP`}
        disabled={claimed}
        loading={claiming}
        onPress={claim}
        accessibilityLabel={claimed ? 'Recompensa de hoje já resgatada' : `Resgatar ${DAILY_REWARD_XP} XP de hoje`}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingVertical: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  caption: { fontSize: 12.5, fontWeight: '500', marginTop: 2 },
});
