import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { ScrollViewRef, ViewRef, scrollFocusedIntoView, useKeyboardLift } from '../lib/keyboard';

/**
 * `ScrollView` de tela com campos de texto que nunca deixa o teclado cobrir
 * (nem "engolir") o formulário. Use no lugar de `KeyboardAvoidingView` +
 * `ScrollView`.
 *
 * - **iOS**: usa o ajuste nativo do próprio `ScrollView`
 *   (`automaticallyAdjustKeyboardInsets`): ele ganha um espaço extra embaixo
 *   do tamanho exato do teclado e rola sozinho até o campo tocado. É o jeito
 *   que o próprio React Native recomenda hoje e não depende de medir nada no
 *   JavaScript — o preenchimento automático de senha / Face ID não confunde.
 * - **Android**: a janela não encolhe mais sozinha com o teclado (o app roda
 *   "de ponta a ponta"), então a área rolável encolhe pelo `useKeyboardLift`
 *   e o campo tocado é rolado até aparecer.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollViewRef, ScrollViewProps>(function KeyboardAwareScrollView(
  props,
  ref,
) {
  if (Platform.OS === 'ios') {
    return (
      <ScrollView
        ref={ref}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        {...props}
      />
    );
  }
  return <AndroidKeyboardAwareScrollView {...props} forwardedRef={ref} />;
});

function AndroidKeyboardAwareScrollView({
  forwardedRef,
  onScroll,
  ...props
}: ScrollViewProps & { forwardedRef: React.ForwardedRef<ScrollViewRef> }) {
  const containerRef = useRef<ViewRef>(null);
  const viewportRef = useRef<ViewRef>(null);
  const scrollRef = useRef<ScrollViewRef>(null);
  const scrollY = useRef(0);
  const lift = useKeyboardLift(containerRef);

  useImperativeHandle(forwardedRef, () => scrollRef.current as ScrollViewRef);

  return (
    <View ref={containerRef} style={[styles.fill, { paddingBottom: lift }]}>
      <View
        ref={viewportRef}
        style={styles.fill}
        onLayout={() => {
          if (lift > 0) scrollFocusedIntoView(scrollRef.current, viewportRef.current, scrollY.current);
        }}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          {...props}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
            onScroll?.(e);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
