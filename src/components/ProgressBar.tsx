import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { prefersReducedMotion } from './Motion';

interface Props {
  /** De 0 a 1 (valores fora disso são limitados). */
  progress: number;
  height?: number;
  /** Cor sólida da barra. Sem ela, usa o gradiente da marca. */
  color?: string;
  /** Duas cores pra um gradiente próprio (ex: cor da patente). */
  gradient?: readonly [string, string];
  trackColor?: string;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Barra de progresso que "enche" animada ao aparecer e a cada mudança. */
export function ProgressBar({ progress, height = 8, color, gradient, trackColor, delay = 0, style }: Props) {
  const { colors } = useTheme();
  const target = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const anim = useRef(new Animated.Value(prefersReducedMotion() ? target : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion()) {
      anim.setValue(target);
      return;
    }
    // Largura não roda no thread nativo — mas é uma barra só, por menos de 1s.
    const a = Animated.timing(anim, {
      toValue: target,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [anim, target, delay]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const fill = color ? null : gradient ?? colors.gradient;

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor ?? colors.border },
        style,
      ]}
    >
      <Animated.View style={{ width, height: '100%', borderRadius: height / 2, overflow: 'hidden', backgroundColor: color }}>
        {fill ? (
          <LinearGradient colors={fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
});
