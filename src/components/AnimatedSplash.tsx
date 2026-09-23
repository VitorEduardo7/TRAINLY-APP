import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Text } from './Typography';
import { prefersReducedMotion } from './Motion';

// Mesma imagem e mesma largura da splash nativa (app.json → expo-splash-screen,
// imageWidth 220): o primeiro quadro desta tela é idêntico ao da nativa, então
// a troca de uma pra outra não pisca.
const LOGO = require('../../assets/splash-icon.png');
const GLOW = require('../../assets/brand/glow.png');
const LOGO_WIDTH = 220;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 836) / 1016);
const BRAND_BG = '#0a0b0f';
/** Tempo mínimo na tela — o suficiente pra animação de entrada terminar. */
const MIN_VISIBLE_MS = 1300;

interface Props {
  /** Fonte e sessão prontas: pode sair assim que o tempo mínimo passar. */
  ready: boolean;
  onFinish: () => void;
  /** Chamado quando a tela já está desenhada (hora de esconder a nativa). */
  onLayout?: (e: LayoutChangeEvent) => void;
}

/**
 * Splash animada do Trainly: o logo "respira" com um brilho azul atrás, o
 * slogan aparece embaixo e, quando o app termina de carregar, tudo cresce um
 * pouco e some. No Expo Go é ela que aparece (o Expo Go mostra só o ícone no
 * lugar da splash nativa); num APK, ela continua exatamente de onde a nativa
 * parou.
 */
export function AnimatedSplash({ ready, onFinish, onLayout }: Props) {
  const reduced = prefersReducedMotion();
  const glow = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const dots = useRef(new Animated.Value(0)).current;
  const dotPhase = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const [minElapsed, setMinElapsed] = useState(false);
  const exiting = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), reduced ? 250 : MIN_VISIBLE_MS);
    const loops: Animated.CompositeAnimation[] = [];
    if (!reduced) {
      Animated.timing(glow, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      Animated.timing(tagline, {
        toValue: 1,
        duration: 520,
        delay: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      // Os pontinhos só aparecem se o carregamento demorar mais que o normal.
      Animated.timing(dots, { toValue: 1, duration: 400, delay: 1500, useNativeDriver: true }).start();
      const breatheLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      const dotsLoop = Animated.loop(
        Animated.timing(dotPhase, { toValue: 3, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
      );
      breatheLoop.start();
      dotsLoop.start();
      loops.push(breatheLoop, dotsLoop);
    }
    return () => {
      clearTimeout(timer);
      loops.forEach((l) => l.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !minElapsed || exiting.current) return;
    exiting.current = true;
    Animated.timing(exit, {
      toValue: 1,
      duration: reduced ? 150 : 460,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onFinish());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minElapsed]);

  const containerOpacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const logoScale = Animated.multiply(
    breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }),
    exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
  );
  const glowOpacity = Animated.multiply(glow, breathe.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.75] }));
  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: containerOpacity }]}
      onLayout={onLayout}
      // Enquanto aparece, segura os toques (a tela de baixo ainda está montando).
      pointerEvents="auto"
    >
      <StatusBar style="light" />

      <Animated.Image
        source={GLOW}
        style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        resizeMode="contain"
      />

      <Animated.View style={{ transform: [{ scale: logoScale }] }}>
        <Image source={LOGO} style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        style={[
          styles.taglineWrap,
          {
            opacity: tagline,
            transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <Text style={styles.tagline}>Treine. Suba de Nível.</Text>
      </Animated.View>

      <Animated.View style={[styles.dots, { opacity: dots }]}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: dotPhase.interpolate({
                  inputRange: [i, i + 0.5, i + 1],
                  outputRange: [0.25, 1, 0.25],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: BRAND_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  glow: { position: 'absolute', width: 380, height: 380 },
  taglineWrap: {
    position: 'absolute',
    top: '50%',
    marginTop: LOGO_HEIGHT / 2 + 26,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tagline: { color: '#9a9caa', fontSize: 14.5, fontWeight: '600', letterSpacing: 0.4 },
  dots: { position: 'absolute', bottom: 72, flexDirection: 'row', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2f7dfd' },
});
