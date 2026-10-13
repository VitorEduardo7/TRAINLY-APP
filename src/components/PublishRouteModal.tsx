import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { FormSheet } from './FormSheet';
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
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Publicar como rota"
      subtitle="O trajeto fica visível pra todo mundo em Explorar."
      icon="map-outline"
      footer={<TrainlyButton title="Publicar rota" icon="paper-plane-outline" onPress={handleSave} loading={saving} />}
    >
      <TrainlyInput label="Nome da rota" placeholder="Ex: Volta do parque" value={name} onChangeText={setName} />

      <Text style={[styles.label, { color: colors.textMuted }]}>Dificuldade</Text>
      <ChipSelector options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} style={styles.chipRow} />

      <TrainlyInput
        label="Terreno (opcional)"
        placeholder="Ex: Asfalto, trilha, pista..."
        value={terrain}
        onChangeText={setTerrain}
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
  chipRow: { marginBottom: 16 },
});
