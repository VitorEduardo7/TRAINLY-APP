import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { levelInfo, nextRankStep, rankTrail, RankStep } from '../lib/rank';
import { RankBadge } from './RankBadge';
import { Text } from './Typography';

interface Props {
  xp: number;
  /** "você" (próprio perfil) ou o primeiro nome do atleta — usado na legenda. */
  subjectName?: string;
}

/**
 * Trilha completa de patentes (Bronze -> Diamante) mostrando, de uma vez só,
 * as que o atleta já conquistou, em qual ele está agora e as que ainda pode
 * evoluir. Diferente do RankWidget (que só mostra a patente atual e a barra
 * do nível), aqui a ideia é ver o caminho inteiro.
 */
export function RankTrail({ xp, subjectName }: Props) {
  const { colors, colorBlindMode } = useTheme();
  const steps = rankTrail(xp, colorBlindMode);
  const next = nextRankStep(xp, colorBlindMode);
  const { level } = levelInfo(xp, colorBlindMode);

  return (
    <View>
      <View style={styles.row}>
        {steps.map((step, i) => (
          <StepColumn
            key={step.name}
            step={step}
            lineBefore={i > 0 ? step.achieved : null}
            lineAfter={i < steps.length - 1 ? steps[i + 1].achieved : null}
          />
        ))}
      </View>

      <View style={[styles.caption, { backgroundColor: colors.surface }]}>
        <Ionicons
          name={next ? 'trending-up' : 'sparkles'}
          size={16}
          color={next ? next.color : colors.primary}
          style={{ marginTop: 1 }}
        />
        {next ? (
          <Text style={[styles.captionText, { color: colors.textMuted }]}>
            {subjectName ? `${subjectName} está` : 'Você está'} no{' '}
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>nível {level}</Text> —{' '}
            {next.levelsAway === 1 ? 'falta 1 nível' : `faltam ${next.levelsAway} níveis`} (
            {next.xpAway.toLocaleString('pt-BR')} XP) pra{' '}
            <Text style={{ color: next.color, fontWeight: '700' }}>{next.name}</Text>.
          </Text>
        ) : (
          <Text style={[styles.captionText, { color: colors.textMuted }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Patente máxima alcançada</Text> — nível{' '}
            {level} e contando.
          </Text>
        )}
      </View>
    </View>
  );
}

function StepColumn({
  step,
  lineBefore,
  lineAfter,
}: {
  step: RankStep;
  /** null = sem linha (primeira coluna); true = trecho já percorrido. */
  lineBefore: boolean | null;
  lineAfter: boolean | null;
}) {
  const { colors } = useTheme();

  const lineColor = (filled: boolean | null) => {
    if (filled === null) return 'transparent';
    return filled ? step.color : colors.border;
  };

  return (
    <View style={styles.col}>
      <View style={styles.badgeRow}>
        <View style={[styles.line, { backgroundColor: lineColor(lineBefore) }]} />

        {/* Caixa de tamanho fixo pra não mudar a altura entre as colunas — a
            patente atual só ganha um emblema maior. */}
        <View style={styles.ring}>
          <RankBadge icon={step.emblem} color={step.color} size={step.isCurrent ? 38 : 28} locked={!step.achieved} />
        </View>

        <View style={[styles.line, { backgroundColor: lineColor(lineAfter) }]} />
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.name,
          { color: step.achieved ? colors.textPrimary : colors.textMuted },
          step.isCurrent && { color: step.color },
        ]}
      >
        {step.name}
      </Text>

      {/* Rótulo curto de propósito: a coluna tem ~60px num iPhone, e
          "conquistada" por extenso não cabe — encostava na coluna vizinha. */}
      <View style={styles.metaRow}>
        {step.achieved && !step.isCurrent ? <Ionicons name="checkmark" size={10} color={colors.textMuted} /> : null}
        <Text style={[styles.meta, { color: step.isCurrent ? step.color : colors.textMuted }]} numberOfLines={1}>
          {step.isCurrent ? 'atual' : `nv ${step.min}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  col: { flex: 1, alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 2 },
  ring: { width: 44, height: 46, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  meta: { fontSize: 11, fontWeight: '500' },
  caption: { flexDirection: 'row', gap: 10, marginTop: 18, padding: 13, borderRadius: 12 },
  captionText: { flex: 1, fontSize: 12.5, fontWeight: '500', lineHeight: 18 },
});
