import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { pickImage, PickedImage } from '../lib/photoUpload';
import { tapLight } from '../lib/haptics';
import { Text } from './Typography';

/** Foto num formulário: ou uma escolhida agora na galeria (`picked`), ou uma que já estava salva (`url`). */
export interface PhotoValue {
  uri: string;
  picked?: PickedImage;
}

interface Props {
  label: string;
  value: PhotoValue | null;
  onChange: (value: PhotoValue | null) => void;
}

/**
 * Campo "Foto (opcional)" dos formulários de publicação e de atividade: um
 * botão pra escolher da galeria e, depois de escolhida, a prévia com as
 * opções de trocar ou tirar. A foto só sobe pro Storage quando o formulário
 * é salvo — escolher e desistir não deixa arquivo sobrando.
 */
export function PhotoField({ label, value, onChange }: Props) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    tapLight();
    setBusy(true);
    try {
      const image = await pickImage();
      if (image) onChange({ uri: image.uri, picked: image });
    } catch (err: any) {
      Alert.alert('Trainly', err?.message ?? 'Não foi possível abrir a galeria.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      {value ? (
        <View style={[styles.preview, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Image source={{ uri: value.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.previewActions}>
            <Pressable onPress={choose} style={styles.chip} accessibilityRole="button" accessibilityLabel="Trocar foto">
              <Ionicons name="swap-horizontal" size={14} color="#fff" />
              <Text style={styles.chipText}>Trocar</Text>
            </Pressable>
            <Pressable onPress={() => onChange(null)} style={styles.chip} accessibilityRole="button" accessibilityLabel="Tirar foto">
              <Ionicons name="trash-outline" size={14} color="#fff" />
              <Text style={styles.chipText}>Tirar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={choose}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Escolher foto da galeria"
          style={({ pressed }) => [
            styles.add,
            { borderColor: colors.border, backgroundColor: colors.surface },
            pressed && { opacity: 0.7 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Ionicons name="image-outline" size={20} color={colors.primary} />
              <Text style={[styles.addText, { color: colors.textPrimary }]}>Escolher foto da galeria</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 7 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    minHeight: 52,
  },
  addText: { fontSize: 14, fontWeight: '600' },
  preview: { height: 180, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  previewActions: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
