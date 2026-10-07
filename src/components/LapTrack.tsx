import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { prefersReducedMotion } from './Motion';

interface Props {
  /** Largura disponível (a altura sai proporcional). */
  width: number;
  /** Quanto da "volta" já foi feito, de 0 a 1 — aqui, o XP rumo ao próximo nível. */
  progress: number;
  /** Conteúdo no "gramado" do meio da pista (nível, patente). */
  children?: React.ReactNode;
}

/** Geometria de uma pista "estádio" (retas + duas curvas) recuada `inset` px da borda. */
function stadium(w: number, h: number, inset: number) {
  const r = (h - inset * 2) / 2;
  const left = inset + r;
  const right = w - inset - r;
  const top = inset;
  const bottom = h - inset;
  const cx = w / 2;
  const half = right - cx; // meia reta de baixo (da largada até a curva)
  const straight = right - left;
  const arc = Math.PI * r;
  const length = half * 2 + straight + arc * 2;
  // Sentido anti-horário, como numa pista de atletismo de verdade: sai da
  // largada (meio da reta de baixo) pra direita, sobe pela curva da direita,
  // volta pela reta de cima e desce pela curva da esquerda.
  const d =
    `M ${cx} ${bottom} L ${right} ${bottom} ` +
    `A ${r} ${r} 0 0 0 ${right} ${top} L ${left} ${top} ` +
    `A ${r} ${r} 0 0 0 ${left} ${bottom} Z`;

  /** Ponto da pista a `s` px da largada, seguindo o mesmo sentido do traçado. */
  const pointAt = (s: number): { x: number; y: number } => {
    let t = ((s % length) + length) % length;
    if (t <= half) return { x: cx + t, y: bottom };
    t -= half;
    const cy = (top + bottom) / 2;
    if (t <= arc) {
      const a = Math.PI / 2 - t / r; // de baixo (90°) pra cima (-90°), passando pela direita
      return { x: right + r * Math.cos(a), y: cy + r * Math.sin(a) };
    }
    t -= arc;
    if (t <= straight) return { x: right - t, y: top };
    t -= straight;
    if (t <= arc) {
      const a = -Math.PI / 2 - t / r; // de cima (-90°) pra baixo (-270°), passando pela esquerda
      return { x: left + r * Math.cos(a), y: cy + r * Math.sin(a) };
    }
    t -= arc;
    return { x: left + t, y: bottom };
  };

  return { d, length, pointAt };
}

/**
 * A "volta" do nível: o XP rumo ao próximo nível desenhado como uma volta
 * numa pista de atletismo vista de cima. A faixa dourada é o quanto já foi
 * percorrido, o ponto azul é o atleta, a linha branca embaixo é a largada —
 * completar a volta é subir de nível. É o elemento-assinatura do Início:
 * diz "progresso" na língua de quem corre, em vez de uma barra genérica.
 */
export function LapTrack({ width, progress, children }: Props) {
  const { colors } = useTheme();
  const height = Math.round(Math.min(190, width * 0.5));
  const target = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const [shown, setShown] = useState(prefersReducedMotion() ? target : 0);
  const anim = useRef(new Animated.Value(shown)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      anim.setValue(target);
      setShown(target);
      return;
    }
    const id = anim.addListener(({ value }) => setShown(value));
    const a = Animated.timing(anim, {
      toValue: target,
      duration: 1100,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => {
      a.stop();
      anim.removeListener(id);
    };
  }, [anim, target]);

  const band = 30; // largura da faixa da pista
  const outer = stadium(width, height, 1);
  const lane1 = stadium(width, height, 1 + band / 3);
  const lane2 = stadium(width, height, 1 + (band * 2) / 3);
  const inner = stadium(width, height, 1 + band);
  const run = stadium(width, height, 1 + band / 2);
  const done = run.length * shown;
  const head = run.pointAt(done);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Path d={outer.d} fill={colors.card} stroke={colors.border} strokeWidth={1} />
        <Path d={lane1.d} fill="none" stroke={colors.border} strokeWidth={1} />
        <Path d={lane2.d} fill="none" stroke={colors.border} strokeWidth={1} />
        <Path d={inner.d} fill={colors.background} stroke={colors.border} strokeWidth={1} />
        {done > 0.5 ? (
          <Path
            d={run.d}
            fill="none"
            stroke={colors.gold}
            strokeWidth={6}
            strokeDasharray={`${done} ${run.length}`}
          />
        ) : null}
        {/* Linha de largada/chegada, atravessando a faixa no meio da reta de baixo. */}
        <Line x1={width / 2} y1={height - 1 - band} x2={width / 2} y2={height - 1} stroke={colors.textPrimary} strokeWidth={2} />
        <Circle cx={head.x} cy={head.y} r={11} fill={colors.primary} opacity={0.25} />
        <Circle cx={head.x} cy={head.y} r={6} fill={colors.primary} stroke={colors.textPrimary} strokeWidth={2} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.infield, { padding: band + 6 }]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infield: { alignItems: 'center', justifyContent: 'center' },
});
