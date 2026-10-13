import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { scrollFocusedIntoView, useKeyboardLift } from '../lib/keyboard';
import { prefersReducedMotion, PressableScale } from './Motion';
import { Text } from './Typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Os campos (`TrainlyInput`) avisam a gaveta quando ganham/perdem o cursor.
 * Só serve de plano B no Android — ver `fallbackLift` abaixo.
 */
const FormSheetFocusContext = createContext<((focused: boolean) => void) | null>(null);
export function useFormSheetFocus() {
  return useContext(FormSheetFocusContext);
}

/** Vira true na primeira vez que o Android avisa do teclado dentro de uma gaveta. */
let androidSheetKeyboardEventsSeen = false;

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Ícone ao lado do título (opcional). */
  icon?: IconName;
  /** Corpo do formulário — rola sozinho quando não cabe. */
  children: React.ReactNode;
  /** Botões de ação: ficam FIXOS embaixo, sempre visíveis, inclusive com o teclado aberto. */
  footer?: React.ReactNode;
}

/**
 * A "gaveta" de formulário do app (registrar atividade, criar clube, editar
 * perfil...): sobe de baixo, com o título fixo em cima, os campos rolando no
 * meio e os botões fixos embaixo.
 *
 * Com o teclado aberto, a gaveta INTEIRA sobe e passa a ocupar só o espaço
 * que sobra acima dele (ver `useKeyboardLift`) — título, campo tocado e
 * botão de salvar continuam à vista, e o campo é rolado até aparecer. Antes
 * isso era feito por um `KeyboardAvoidingView`, que errava a conta dentro do
 * `<Modal>` e jogava a janela pra fora da tela.
 */
export function FormSheet({ visible, onClose, title, subtitle, icon, children, footer }: Props) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const overlayRef = useRef<View>(null);
  const viewportRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const keyboardLift = useKeyboardLift(overlayRef, { enabled: visible });
  const slide = useRef(new Animated.Value(0)).current;

  // Plano B do Android: lá a gaveta é uma janela separada (um "Dialog") e,
  // dependendo da versão do sistema, o aviso de "teclado abriu" pode não
  // chegar até ela. Se um campo ganhou o cursor e nenhum aviso veio em
  // ~0,6 s, sobe a gaveta numa altura típica de teclado (42% da tela) em vez
  // de deixar o campo escondido. Assim que um aviso de verdade chega uma
  // vez, o plano B é desligado de vez e só a medida exata vale.
  const [inputFocused, setInputFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFocusChange = useCallback((focused: boolean) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    if (focused) setInputFocused(true);
    // Pequena espera: trocar de um campo pro outro não deve "piscar" a gaveta.
    else blurTimer.current = setTimeout(() => setInputFocused(false), 150);
  }, []);
  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);
  if (keyboardLift > 0 && Platform.OS === 'android') androidSheetKeyboardEventsSeen = true;
  const [fallbackLift, setFallbackLift] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android' || androidSheetKeyboardEventsSeen || !visible || !inputFocused || keyboardLift > 0) {
      setFallbackLift(0);
      return;
    }
    const t = setTimeout(() => setFallbackLift(Math.round((overlayHeight || windowHeight) * 0.42)), 600);
    return () => clearTimeout(t);
  }, [visible, inputFocused, keyboardLift, overlayHeight, windowHeight]);
  const lift = keyboardLift > 0 ? keyboardLift : fallbackLift;

  // Entrada: o fundo escurece (fade do Modal) e a gaveta sobe com uma mola
  // curta. Com "Reduzir animações", aparece direto.
  useEffect(() => {
    if (!visible) return;
    if (prefersReducedMotion()) {
      slide.setValue(1);
      return;
    }
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const available = (overlayHeight || windowHeight) - lift - insets.top - 10;
  const keyboardOpen = lift > 0;

  // Toque no fundo escuro: primeiro fecha o teclado; sem teclado, fecha a gaveta.
  const handleBackdrop = () => {
    if (Keyboard.isVisible() || TextInput.State.currentlyFocusedInput?.()) Keyboard.dismiss();
    else onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        ref={overlayRef}
        onLayout={(e) => setOverlayHeight(e.nativeEvent.layout.height)}
        style={[styles.overlay, { paddingBottom: lift }]}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: mode === 'dark' ? 'rgba(6,4,16,0.72)' : 'rgba(20,15,42,0.45)' }]}
          onPress={handleBackdrop}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              maxHeight: Math.max(240, available),
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            {icon ? (
              <View style={[styles.headerIcon, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
                <Ionicons name={icon} size={18} color={colors.primary} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <PressableScale
              onPress={onClose}
              scaleTo={0.9}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={[styles.close, { borderColor: colors.border }]}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </PressableScale>
          </View>

          <View
            ref={viewportRef}
            style={styles.viewport}
            // A gaveta encolheu (o teclado abriu) → garante o campo tocado à vista.
            onLayout={() => {
              if (keyboardOpen) scrollFocusedIntoView(scrollRef.current, viewportRef.current, scrollY.current);
            }}
          >
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
              scrollEventThrottle={16}
              onScroll={(e) => {
                scrollY.current = e.nativeEvent.contentOffset.y;
              }}
            >
              <FormSheetFocusContext.Provider value={onFocusChange}>{children}</FormSheetFocusContext.Provider>
            </ScrollView>
          </View>

          <View
            style={[
              styles.footer,
              footer ? { borderTopColor: colors.border, borderTopWidth: 1 } : null,
              // Com o teclado aberto ele já cobre a barra de gestos — sem folga extra.
              { paddingBottom: (footer ? 12 : 4) + (keyboardOpen ? 0 : insets.bottom) },
            ]}
          >
            {footer}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  headerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 3, lineHeight: 18 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  viewport: { flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
});
