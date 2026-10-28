import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { FadeIn } from './Motion';

/**
 * Foto de publicação/atividade dentro de um card: ocupa a largura toda e
 * mantém a proporção real da imagem (limitada entre bem deitada e um pouco
 * em pé, pra uma foto vertical não virar uma tela inteira no meio do feed).
 * Tocar abre a foto em tela cheia.
 */
export function CardPhoto({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const [ratio, setRatio] = useState(4 / 3);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (alive && w > 0 && h > 0) setRatio(Math.max(0.8, Math.min(1.9, w / h)));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Abrir foto em tela cheia"
        style={[styles.frame, { backgroundColor: colors.surface, aspectRatio: ratio }, style]}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </Pressable>
      <PhotoViewer uri={open ? uri : null} onClose={() => setOpen(false)} />
    </>
  );
}

/** Foto em tela cheia, inteira (sem cortar). Toque em qualquer lugar fecha. */
export function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!uri) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar foto">
        <FadeIn duration={180} offset={0}>
          <Image source={{ uri }} style={{ width: width - 24, height: height * 0.78 }} resizeMode="contain" />
        </FadeIn>
        <View style={[styles.closeBtn, { top: insets.top + 12 }]}>
          <Ionicons name="close" size={22} color="#fff" />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
