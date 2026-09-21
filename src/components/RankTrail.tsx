import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { levelInfo, nextRankStep, rankTrail, RankStep } from '../lib/rank';

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
  const { colors } = useTheme();
  const steps = rankTrail(xp);
  const next = nextRankStep(xp);
  const { level } = levelInfo(xp);

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

      <View style={[styles.caption, { borderColor: colors.border }]}>
        {next ? (
          <Text style={[styles.captionText, { color: colors.textMuted }]}>
            {subjectName ? `${subjectName} está` : 'Você está'} no{' '}
            <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>nível {level}</Text> —{' '}
            {next.levelsAway === 1 ? 'falta 1 nível' : `faltam ${next.levelsAway} níveis`} (
            {next.xpAway.toLocaleString('pt-BR')} XP) pra{' '}
            <Text style={{ color: next.color, fontWeight: '800' }}>{next.name}</Text>.
          </Text>
        ) : (
          <Text style={[styles.captionText, { color: colors.textMuted }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Patente máxima alcançada</Text> 🎉 — nível{' '}
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

        {/* Anel externo: sempre presente pra não mudar a altura entre as
            colunas — só ganha cor na patente atual. */}
        <View
          style={[
            styles.ring,
            { borderColor: step.isCurrent ? step.color : 'transparent' },
          ]}
        >
          <View
            style={[
              styles.badge,
              step.achieved
                ? { backgroundColor: step.color, borderColor: step.color }
                : { backgroundColor: colors.background, borderColor: colors.border, borderStyle: 'dashed' },
            ]}
          >
            <Text style={[styles.emblem, !step.achieved && styles.emblemLocked]}>{step.emblem}</Text>
          </View>
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
      <Text
        style={[
          styles.meta,
          { color: step.isCurrent ? step.color : colors.textMuted },
        ]}
        numberOfLines={1}
      >
        {step.isCurrent ? 'atual' : step.achieved ? `✓ nv ${step.min}` : `nv ${step.min}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  col: { flex: 1, alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 3, borderRadius: 2 },
  ring: { padding: 3, borderRadius: 26, borderWidth: 2 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblem: { fontSize: 18 },
  emblemLocked: { opacity: 0.3 },
  name: { fontSize: 11, fontWeight: '800', marginTop: 8 },
  meta: { fontSize: 9.5, fontWeight: '700', marginTop: 3, textTransform: 'uppercase' },
  caption: { borderTopWidth: 1, marginTop: 16, paddingTop: 12 },
  captionText: { fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
});
