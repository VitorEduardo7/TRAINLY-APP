import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { niceMax } from '../lib/evolution';
import { useFontsReady } from '../theme/fonts';

/**
 * Dois gráficos simples desenhados com SVG (sem biblioteca de gráfico):
 * barras pra quantidade (km por mês) e linha pra tendência (ritmo médio).
 * Uma série só em cada — a cor é a do app, o título diz o que é. Tocar numa
 * coluna seleciona aquele mês nos dois gráficos ao mesmo tempo.
 */

const AXIS_W = 34;
const TOP = 24;
const BOTTOM = 24;

/** Rótulos do SVG na mesma fonte do app (quando ela já carregou). */
function useSvgFont() {
  const ready = useFontsReady();
  return {
    regular: ready ? { fontFamily: 'Inter_500Medium' } : {},
    bold: ready ? { fontFamily: 'Inter_700Bold' } : {},
  };
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

/** Só mostra todos os meses quando cabem; senão um sim, um não (o atual sempre). */
function showLabel(i: number, n: number, selected: number, slot: number): boolean {
  if (slot >= 26 || i === selected) return true;
  return (n - 1 - i) % 2 === 0;
}

interface BarProps {
  data: { label: string; value: number }[];
  selected: number;
  onSelect: (i: number) => void;
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
  height?: number;
  accessibilityLabel?: string;
}

export function MonthlyBarChart({ data, selected, onSelect, formatValue, formatTick, height = 170, accessibilityLabel }: BarProps) {
  const { colors } = useTheme();
  const font = useSvgFont();
  const [width, onLayout] = useWidth();
  const n = data.length;
  const plotW = Math.max(0, width - AXIS_W);
  const slot = n ? plotW / n : 0;
  const barW = Math.max(6, Math.min(26, slot * 0.6));
  const max = Math.max(0, ...data.map((d) => d.value));
  const yMax = niceMax(max);
  const base = TOP + height;
  const maxIndex = max > 0 ? data.findIndex((d) => d.value === max) : -1;
  const ticks = [0, yMax / 2, yMax];

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={accessibilityLabel} style={{ height: TOP + height + BOTTOM }}>
      {width > 0 && (
        <Svg width={width} height={TOP + height + BOTTOM}>
          {ticks.map((t) => {
            const y = base - (t / yMax) * height;
            return (
              <React.Fragment key={t}>
                <Line x1={AXIS_W} x2={width} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />
                <SvgText x={AXIS_W - 6} y={y + 3.5} fontSize={10} fill={colors.textMuted} textAnchor="end" {...font.regular}>
                  {formatTick(t)}
                </SvgText>
              </React.Fragment>
            );
          })}
          {data.map((d, i) => {
            const cx = AXIS_W + slot * (i + 0.5);
            const x0 = cx - barW / 2;
            const x1 = cx + barW / 2;
            const h = d.value > 0 ? Math.max(3, (d.value / yMax) * height) : 0;
            const yTop = base - h;
            const r = Math.min(4, barW / 2, h);
            const isSel = i === selected;
            return (
              <React.Fragment key={i}>
                {h > 0 && (
                  <Path
                    d={`M${x0},${base} L${x0},${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} L${x1 - r},${yTop} Q${x1},${yTop} ${x1},${yTop + r} L${x1},${base} Z`}
                    fill={isSel ? colors.primary : withAlpha(colors.primary, 0.35)}
                  />
                )}
                {/* Rótulo só no mês selecionado e no maior (não em todos). */}
                {(isSel || i === maxIndex) && d.value > 0 && (
                  <SvgText
                    x={cx}
                    y={yTop - 6}
                    fontSize={10.5}
                    fontWeight="700"
                    fill={isSel ? colors.textPrimary : colors.textMuted}
                    textAnchor="middle"
                    {...font.bold}
                  >
                    {formatValue(d.value)}
                  </SvgText>
                )}
                {showLabel(i, n, selected, slot) && (
                  <SvgText
                    x={cx}
                    y={base + 16}
                    fontSize={10.5}
                    fontWeight={isSel ? '700' : '500'}
                    fill={isSel ? colors.textPrimary : colors.textMuted}
                    textAnchor="middle"
                    {...(isSel ? font.bold : font.regular)}
                  >
                    {d.label}
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      )}
      {/* Áreas de toque maiores que as barras. */}
      <View style={[StyleSheet.absoluteFill, { left: AXIS_W, flexDirection: 'row' }]}>
        {data.map((d, i) => (
          <Pressable
            key={i}
            style={{ flex: 1 }}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
          />
        ))}
      </View>
    </View>
  );
}

interface LineProps {
  data: { label: string; value: number | null }[];
  selected: number;
  onSelect: (i: number) => void;
  /** true = valor maior fica mais embaixo (ritmo: menor é mais rápido, então o mais rápido fica em cima). */
  invert?: boolean;
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
  /** Índice do melhor mês (ganha o rótulo "melhor"). */
  bestIndex?: number;
  height?: number;
  accessibilityLabel?: string;
}

export function TrendLineChart({
  data,
  selected,
  onSelect,
  invert,
  formatValue,
  formatTick,
  bestIndex = -1,
  height = 150,
  accessibilityLabel,
}: LineProps) {
  const { colors } = useTheme();
  const font = useSvgFont();
  const [width, onLayout] = useWidth();
  const n = data.length;
  const plotW = Math.max(0, width - AXIS_W);
  const slot = n ? plotW / n : 0;
  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (!values.length) {
    lo = 0;
    hi = 1;
  } else if (hi - lo < 1e-6) {
    lo = lo * 0.9;
    hi = hi * 1.1 || 1;
  } else {
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
  }
  const yOf = (v: number) => (invert ? TOP + ((v - lo) / (hi - lo)) * height : TOP + ((hi - v) / (hi - lo)) * height);
  const xOf = (i: number) => AXIS_W + slot * (i + 0.5);

  const points = data.map((d, i) => (d.value == null ? null : { i, x: xOf(i), y: yOf(d.value), v: d.value }));
  const present = points.filter((p): p is NonNullable<typeof p> => p != null);
  const segments: { d: string; dashed: boolean }[] = [];
  for (let k = 1; k < present.length; k++) {
    const a = present[k - 1];
    const b = present[k];
    segments.push({ d: `M${a.x},${a.y} L${b.x},${b.y}`, dashed: b.i - a.i > 1 });
  }
  const tickValues = [lo + (hi - lo) * 0.12, (lo + hi) / 2, hi - (hi - lo) * 0.12];

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={accessibilityLabel} style={{ height: TOP + height + BOTTOM }}>
      {width > 0 && (
        <Svg width={width} height={TOP + height + BOTTOM}>
          {values.length > 0 &&
            tickValues.map((t, k) => {
              const y = yOf(t);
              return (
                <React.Fragment key={k}>
                  <Line x1={AXIS_W} x2={width} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />
                  <SvgText x={AXIS_W - 6} y={y + 3.5} fontSize={10} fill={colors.textMuted} textAnchor="end" {...font.regular}>
                    {formatTick(t)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          {segments.map((s, k) => (
            <Path
              key={k}
              d={s.d}
              stroke={colors.primary}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '4 5' : undefined}
              strokeLinecap="round"
              fill="none"
              opacity={s.dashed ? 0.6 : 1}
            />
          ))}
          {present.map((p) => {
            const isSel = p.i === selected;
            return (
              <React.Fragment key={p.i}>
                <Circle cx={p.x} cy={p.y} r={isSel ? 6 : 4} fill={colors.primary} stroke={colors.card} strokeWidth={2} />
                {(isSel || p.i === bestIndex) && (
                  <SvgText
                    x={p.x}
                    y={p.y - 11}
                    fontSize={10.5}
                    fontWeight="700"
                    fill={isSel ? colors.textPrimary : colors.textMuted}
                    textAnchor="middle"
                    {...font.bold}
                  >
                    {isSel ? formatValue(p.v) : 'melhor'}
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
          {data.map((d, i) =>
            showLabel(i, n, selected, slot) ? (
              <SvgText
                key={i}
                x={xOf(i)}
                y={TOP + height + 16}
                fontSize={10.5}
                fontWeight={i === selected ? '700' : '500'}
                fill={i === selected ? colors.textPrimary : colors.textMuted}
                textAnchor="middle"
                {...(i === selected ? font.bold : font.regular)}
              >
                {d.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
      <View style={[StyleSheet.absoluteFill, { left: AXIS_W, flexDirection: 'row' }]}>
        {data.map((d, i) => (
          <Pressable
            key={i}
            style={{ flex: 1 }}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityLabel={`${d.label}: ${d.value == null ? 'sem treino' : formatValue(d.value)}`}
          />
        ))}
      </View>
    </View>
  );
}
