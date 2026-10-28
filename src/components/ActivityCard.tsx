import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Activity } from '../types/models';
import { formatClock, formatKm, paceMinPerKm } from '../lib/geo';
import { Card } from './Card';
import { CardPhoto } from './Photo';
import { SportBadge } from './SportIcon';
import { XpChip } from './XpChip';
import { Text } from './Typography';

interface Props {
  activity: Activity;
  /** Mostra o XP ganho (no próprio histórico). Em perfil de outra pessoa fica escondido, como no site. */
  showXp?: boolean;
  /** Botão "⋯" (editar/excluir) — só nas atividades da própria pessoa. */
  onMore?: () => void;
  /** Conteúdo extra no rodapé do card (ex: "Publicar como rota" no Histórico). */
  footer?: React.ReactNode;
}

/**
 * Um treino registrado. Só informação — sem curtir nem comentar, igual ao
 * site: a conversa entre amigos acontece nas publicações.
 */
export function ActivityCard({ activity, showXp = true, onMore, footer }: Props) {
  const { colors } = useTheme();
  const km = Number(activity.distance_km);
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <SportBadge type={activity.type} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {activity.title || activity.type}
          </Text>
          <Text style={[styles.date, { color: colors.textMuted }]}>
            {new Date(activity.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            {' · '}
            {activity.type}
          </Text>
        </View>
        {showXp ? <XpChip xp={activity.xp_earned} /> : null}
        {onMore ? (
          <Pressable
            onPress={onMore}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Editar ou excluir atividade"
            style={[styles.more, { borderColor: colors.border }]}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {activity.photo_url ? <CardPhoto uri={activity.photo_url} style={{ marginBottom: 12 }} /> : null}

      <View style={[styles.stats, { borderColor: colors.border }]}>
        <Stat label="Distância" value={`${formatKm(km)} km`} />
        <Stat label="Tempo" value={formatClock(activity.duration_sec)} />
        <Stat label="Ritmo" value={`${paceMinPerKm(km, activity.duration_sec)}/km`} />
        {activity.elevation_m ? <Stat label="Elevação" value={`${activity.elevation_m} m`} /> : null}
      </View>

      {footer ? <View style={{ marginTop: 12 }}>{footer}</View> : null}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.value, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  more: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12 },
  value: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '500', marginTop: 3 },
});
