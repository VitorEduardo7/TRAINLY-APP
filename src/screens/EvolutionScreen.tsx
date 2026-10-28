import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useActivities } from '../hooks/useActivities';
import { Card } from '../components/Card';
import { ChipSelector } from '../components/ChipSelector';
import { EmptyState } from '../components/EmptyState';
import { FadeIn, PressableScale } from '../components/Motion';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { SectionTitle } from '../components/SectionTitle';
import { MonthlyBarChart, TrendLineChart } from '../components/EvolutionCharts';
import { Text } from '../components/Typography';
import { formatKmShort } from '../lib/geo';
import { selection } from '../lib/haptics';
import {
  PACE_TITLE,
  bucketPace,
  formatAxisNumber,
  formatPace,
  formatPaceTick,
  higherIsBetter,
  monthlyBuckets,
  mostCommonType,
  paceKindFor,
} from '../lib/evolution';
import { ActivityType } from '../types/models';

const SPORTS = ['Todos', 'Corrida', 'Ciclismo', 'Caminhada', 'Natação'] as const;
type SportOption = (typeof SPORTS)[number];
type Period = '6' | '12';

function kmText(km: number): string {
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

function hoursText(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/**
 * Evolução: como a pessoa vem treinando mês a mês. Dois gráficos — km por mês
 * (barras) e ritmo médio (linha) — mais um resumo do período e a tabela com
 * os números (pra quem prefere ler a ver o gráfico).
 */
export function EvolutionScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { activities, loading, reload } = useActivities(profile?.id);
  const [period, setPeriod] = useState<Period>('6');
  const [sport, setSport] = useState<SportOption>('Todos');
  const [selected, setSelected] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const months = Number(period);
  const type: ActivityType | null = sport === 'Todos' ? null : sport;
  const buckets = useMemo(() => monthlyBuckets(activities, months, type), [activities, months, type]);
  const sel = selected == null || selected >= buckets.length ? buckets.length - 1 : selected;
  const current = buckets[sel];
  const previous = sel > 0 ? buckets[sel - 1] : null;

  // Ritmo só faz sentido por esporte. Em "Todos", usa o esporte mais comum.
  const paceType: ActivityType | null = type ?? mostCommonType(activities);
  const paceBuckets = useMemo(
    () => (paceType ? (type ? buckets : monthlyBuckets(activities, months, paceType)) : []),
    [paceType, type, buckets, activities, months],
  );
  const paceKind = paceKindFor(paceType ?? 'Corrida');
  const paceValues = paceBuckets.map((b) => bucketPace(b, paceKind));
  const bestPaceIndex = paceValues.reduce<number>((best, v, i) => {
    if (v == null) return best;
    if (best < 0) return i;
    const bv = paceValues[best] as number;
    return (higherIsBetter(paceKind) ? v > bv : v < bv) ? i : best;
  }, -1);
  const pacePoints = paceValues.filter((v) => v != null).length;

  const totalKm = buckets.reduce((s, b) => s + b.km, 0);
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);
  const totalSec = buckets.reduce((s, b) => s + b.seconds, 0);
  const activeMonths = buckets.filter((b) => b.count > 0).length;

  const change =
    previous && previous.km > 0 ? Math.round(((current.km - previous.km) / previous.km) * 100) : null;

  const select = (i: number) => {
    selection();
    setSelected(i);
  };

  if (loading && activities.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
    >
      <SegmentedTabs
        options={[
          { value: '6', label: '6 meses' },
          { value: '12', label: '12 meses' },
        ]}
        value={period}
        onChange={(v) => {
          setPeriod(v);
          setSelected(null);
        }}
      />
      <ChipSelector options={SPORTS} value={sport} onChange={setSport} style={{ marginTop: 12 }} />

      {activities.length === 0 ? (
        <EmptyState
          icon="analytics-outline"
          title="Ainda sem dados"
          message="Registre alguns treinos e volte aqui pra ver sua evolução mês a mês."
        />
      ) : (
        <>
          <FadeIn>
            <View style={styles.tiles}>
              <Tile label="No período" value={kmText(totalKm)} />
              <Tile label="Média por mês" value={kmText(totalKm / months)} />
              <Tile label="Treinos" value={String(totalCount)} hint={hoursText(totalSec)} />
            </View>
          </FadeIn>

          <FadeIn delay={60}>
            <SectionTitle title="Km por mês" style={{ marginTop: 24 }} />
            <Card>
              <View style={styles.selRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selMonth, { color: colors.textMuted }]}>{current.longLabel}</Text>
                  <Text style={[styles.selValue, { color: colors.textPrimary }]}>{kmText(current.km)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.selMeta, { color: colors.textMuted }]}>
                    {current.count === 1 ? '1 treino' : `${current.count} treinos`} · {hoursText(current.seconds)}
                  </Text>
                  {change != null ? (
                    <View style={styles.changeRow}>
                      <Ionicons
                        name={change >= 0 ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color={change >= 0 ? colors.success : colors.danger}
                      />
                      <Text style={[styles.selMeta, { color: colors.textPrimary, fontWeight: '700' }]}>
                        {Math.abs(change)}% vs mês anterior
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <MonthlyBarChart
                data={buckets.map((b) => ({ label: b.label, value: b.km }))}
                selected={sel}
                onSelect={select}
                formatValue={formatKmShort}
                formatTick={formatAxisNumber}
                accessibilityLabel={`Km por mês. ${buckets.map((b) => `${b.label}: ${kmText(b.km)}`).join(', ')}`}
              />
              <Text style={[styles.caption, { color: colors.textMuted }]}>
                Toque numa coluna pra ver o mês. {activeMonths} de {months} meses com treino.
              </Text>
            </Card>
          </FadeIn>

          <FadeIn delay={120}>
            <SectionTitle
              title={`${PACE_TITLE[paceKind]}${paceType ? ` · ${paceType}` : ''}`}
              style={{ marginTop: 24 }}
            />
            <Card>
              {pacePoints === 0 ? (
                <Text style={[styles.caption, { color: colors.textMuted, marginTop: 0 }]}>
                  Sem treinos de {paceType?.toLowerCase() ?? 'nenhum esporte'} nesse período.
                </Text>
              ) : (
                <>
                  <View style={styles.selRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selMonth, { color: colors.textMuted }]}>{current.longLabel}</Text>
                      <Text style={[styles.selValue, { color: colors.textPrimary }]}>
                        {paceValues[sel] != null ? formatPace(paceValues[sel] as number, paceKind) : 'sem treino'}
                      </Text>
                    </View>
                    {bestPaceIndex >= 0 ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.selMeta, { color: colors.textMuted }]}>Melhor mês</Text>
                        <Text style={[styles.selMeta, { color: colors.textPrimary, fontWeight: '700' }]}>
                          {paceBuckets[bestPaceIndex].label} ·{' '}
                          {formatPace(paceValues[bestPaceIndex] as number, paceKind)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <TrendLineChart
                    data={paceBuckets.map((b, i) => ({ label: b.label, value: paceValues[i] }))}
                    selected={sel}
                    onSelect={select}
                    invert={!higherIsBetter(paceKind)}
                    bestIndex={bestPaceIndex}
                    formatValue={(v) => formatPaceTick(v, paceKind)}
                    formatTick={(v) => formatPaceTick(v, paceKind)}
                    accessibilityLabel={`${PACE_TITLE[paceKind]} por mês`}
                  />
                  <Text style={[styles.caption, { color: colors.textMuted }]}>
                    {higherIsBetter(paceKind)
                      ? 'Mais alto = mais rápido.'
                      : 'Mais alto = mais rápido (menos minutos por km).'}
                    {sport === 'Todos' ? ` Mostrando ${paceType?.toLowerCase()}, seu esporte mais comum.` : ''}
                  </Text>
                </>
              )}
            </Card>
          </FadeIn>

          <FadeIn delay={160}>
            <PressableScale
              onPress={() => {
                selection();
                setShowTable((v) => !v);
              }}
              style={styles.tableToggle}
              accessibilityRole="button"
            >
              <Ionicons name={showTable ? 'chevron-up' : 'list'} size={16} color={colors.primary} />
              <Text style={[styles.tableToggleText, { color: colors.primary }]}>
                {showTable ? 'Esconder tabela' : 'Ver os números em tabela'}
              </Text>
            </PressableScale>
            {showTable && (
              <Card style={{ paddingVertical: 8 }}>
                <View style={[styles.tr, { borderColor: colors.border, borderTopWidth: 0 }]}>
                  <Text style={[styles.th, { color: colors.textMuted, flex: 1.2 }]}>Mês</Text>
                  <Text style={[styles.th, { color: colors.textMuted }]}>Km</Text>
                  <Text style={[styles.th, { color: colors.textMuted }]}>Treinos</Text>
                  <Text style={[styles.th, { color: colors.textMuted, flex: 1.3 }]}>{paceKind === 'kmh' ? 'Veloc.' : 'Ritmo'}</Text>
                </View>
                {[...buckets].reverse().map((b) => {
                  const i = buckets.indexOf(b);
                  const p = paceValues[i];
                  return (
                    <View key={b.key} style={[styles.tr, { borderColor: colors.border }]}>
                      <Text style={[styles.td, { color: colors.textPrimary, flex: 1.2 }]}>{b.label}</Text>
                      <Text style={[styles.td, { color: colors.textPrimary }]}>{formatKmShort(b.km)}</Text>
                      <Text style={[styles.td, { color: colors.textPrimary }]}>{b.count}</Text>
                      <Text style={[styles.td, { color: colors.textPrimary, flex: 1.3 }]}>
                        {p != null ? formatPace(p, paceKind) : '—'}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            )}
          </FadeIn>
        </>
      )}
    </ScrollView>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.tile}>
      <Text style={[styles.tileLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.tileValue, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {hint ? <Text style={[styles.tileLabel, { color: colors.textMuted, marginTop: 2 }]}>{hint}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 18 },
  tile: { flex: 1, padding: 12 },
  tileLabel: { fontSize: 11.5, fontWeight: '600' },
  tileValue: { fontSize: 19, fontWeight: '900', fontStyle: 'italic', marginTop: 4 },
  selRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, gap: 10 },
  selMonth: { fontSize: 12, fontWeight: '600' },
  selValue: { fontSize: 26, fontWeight: '900', fontStyle: 'italic', marginTop: 2 },
  selMeta: { fontSize: 12, fontWeight: '500' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  caption: { fontSize: 12, fontWeight: '500', marginTop: 6, lineHeight: 17 },
  tableToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  tableToggleText: { fontSize: 13.5, fontWeight: '700' },
  tr: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: 9 },
  th: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  td: { flex: 1, fontSize: 13, fontWeight: '600' },
});
