import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Animações de acabamento do app, todas com a API `Animated` que já vem no
 * React Native (sem biblioteca extra) e rodando no thread nativo
 * (`useNativeDriver`) sempre que possível — não disputam com a lógica da tela.
 *
 * Respeitam o "Reduzir movimento": do celular (ajuste de sistema) OU do app
 * (Configurações → Acessibilidade → "Reduzir animações", pra quem quer isso
 * só dentro do Trainly sem mexer no ajuste do sistema inteiro). Qualquer um
 * dos dois ligado já é suficiente pra tudo aparecer direto, sem animação.
 */

const MANUAL_REDUCE_MOTION_KEY = 'trainly_a11y_reduce_motion';

let systemReduceMotion = false;
let manualReduceMotion = false;
const reduceMotionListeners = new Set<(v: boolean) => void>();

function notifyReduceMotionListeners() {
  const combined = systemReduceMotion || manualReduceMotion;
  reduceMotionListeners.forEach((fn) => fn(combined));
}

AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    systemReduceMotion = v;
    notifyReduceMotionListeners();
  })
  .catch(() => {});

AsyncStorage.getItem(MANUAL_REDUCE_MOTION_KEY)
  .then((saved) => {
    manualReduceMotion = saved === '1';
    notifyReduceMotionListeners();
  })
  .catch(() => {});

// Sem isso, o valor só era lido uma vez ao abrir o app — mudar "Reduzir
// movimento" nos Ajustes (ou na Central de Controle, no iOS) com o app já
// aberto não tinha efeito nenhum até reiniciar. Com o listener, atualiza na
// hora pra qualquer novo toque/animação que começar dali pra frente.
AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
  systemReduceMotion = v;
  notifyReduceMotionListeners();
});

/** Liga/desliga o override manual (tela de Configurações), persistindo a escolha. */
export function setManualReduceMotion(value: boolean): void {
  manualReduceMotion = value;
  notifyReduceMotionListeners();
  AsyncStorage.setItem(MANUAL_REDUCE_MOTION_KEY, value ? '1' : '0').catch(() => {});
}

export function getManualReduceMotion(): boolean {
  return manualReduceMotion;
}

export function prefersReducedMotion(): boolean {
  return systemReduceMotion || manualReduceMotion;
}

/** Versão reativa: o componente re-renderiza sozinho se o ajuste mudar com o app aberto. */
export function useReducedMotion(): boolean {
  const [value, setValue] = useState(prefersReducedMotion());
  useEffect(() => {
    reduceMotionListeners.add(setValue);
    setValue(prefersReducedMotion());
    return () => {
      reduceMotionListeners.delete(setValue);
    };
  }, []);
  return value;
}

interface FadeInProps {
  children: React.ReactNode;
  /** Atraso em ms — use pra entrar em cascata (ex: índice * 60). */
  delay?: number;
  duration?: number;
  /** Deslocamento vertical inicial, em pixels. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/** Entrada suave: aparece subindo alguns pixels. Roda uma vez, ao montar. */
export function FadeIn({ children, delay = 0, duration = 420, offset = 14, style }: FadeInProps) {
  const progress = useRef(new Animated.Value(prefersReducedMotion() ? 1 : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    // Se a tela sair antes de terminar, garante o estado final visível —
    // nunca fica nada preso invisível.
    return () => {
      anim.stop();
      progress.setValue(1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Quanto encolhe ao tocar (1 = nada). */
  scaleTo?: number;
}

/**
 * `Pressable` que encolhe de leve ao tocar e volta — resposta firme, sem
 * "quique" (a mola elástica de antes deixava o app com cara de brinquedo). O estilo vai direto no Pressable, então `flex: 1` e afins
 * funcionam igual antes.
 */
export function PressableScale({ children, style, scaleTo = 0.98, onPressIn, onPressOut, disabled, ...rest }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (toValue: number) => {
    if (prefersReducedMotion()) return;
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        springTo(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        springTo(1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Valor que "respira" entre 0 e 1 sem parar — pra indicadores de "ao vivo"
 * (gravando corrida, carregando).
 */
export function usePulse(duration = 900): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration]);
  return value;
}
