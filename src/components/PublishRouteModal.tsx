import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { ChipSelector } from './ChipSelector';
import { Text } from './Typography';
import { RouteDifficulty } from '../types/models';

const DIFFICULTIES: RouteDifficulty[] = ['Fácil', 'Moderada', 'Difícil'];

interface Props {
  visible: boolean;
  onClose: () => void;
  activityTitle: string;
  onSave: (input: { name: string; difficulty: RouteDifficulty; terrain: string }) => Promise<unknown>;
}

export function PublishRouteModal({ visible, onClose, activityTitle, onSave }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(activityTitle);
  const [difficulty, setDifficulty] = useState<RouteDifficulty>('Moderada');
  const [terrain, setTerrain] = useState('');
  const [saving, setSaving] = useState(false);

  // Sem haptic de sucesso aqui de propósito: quem chama esse modal (a tela de
  // Histórico) já dispara `success()` ao publicar de verdade — duplicar aqui
  // faria vibrar duas vezes pra uma única ação.
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Trainly', 'Dê um nome à rota.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), difficulty, terrain: terrain.trim() });
      onClose();
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível publicar a rota.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* paddingBottom soma o inset pra os botões não ficarem sob a barra de gestos. */}
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: 22 + insets.bottom }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Publicar como Rota</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              O trajeto dessa atividade fica visível pra qualquer pessoa em Explorar Rotas.
            </Text>

            <TrainlyInput label="Nome da rota" placeholder="Ex: Volta do parque" value={name} onChangeText={setName} />

            <Text style={[styles.label, { color: colors.textMuted }]}>Dificuldade</Text>
            <ChipSelector options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} style={styles.chipRow} />

            <TrainlyInput
              label="Terreno (opcional)"
              placeholder="Ex: Asfalto, trilha, pista..."
              value={terrain}
              onChangeText={setTerrain}
            />

            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <TrainlyButton title="Cancelar" variant="secondary" onPress={onClose} />
              </View>
              <View style={{ flex: 1 }}>
                <TrainlyButton title="Publicar" onPress={handleSave} loading={saving} />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingTop: 12, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 12.5, fontWeight: '600', marginBottom: 16, lineHeight: 17 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
  chipRow: { marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
