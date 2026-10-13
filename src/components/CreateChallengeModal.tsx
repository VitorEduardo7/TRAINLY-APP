import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { FormSheet } from './FormSheet';
import { success } from '../lib/haptics';
import { maskDateInput } from '../lib/textMask';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (input: { title: string; description?: string; goalKm: number; startDate: string; endDate: string }) => Promise<unknown>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function CreateChallengeModal({ visible, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalKm, setGoalKm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setGoalKm('');
    setStartDate('');
    setEndDate('');
  };

  const handleSave = async () => {
    const goal = parseFloat(goalKm.replace(',', '.'));
    if (!title.trim()) {
      Alert.alert('Trainly', 'Dê um título ao desafio.');
      return;
    }
    if (!goal || goal <= 0) {
      Alert.alert('Trainly', 'Informe a meta em km (ex: 30).');
      return;
    }
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      Alert.alert('Trainly', 'Datas no formato AAAA-MM-DD (ex: 2026-10-01).');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Trainly', 'A data final precisa ser depois da inicial.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), goalKm: goal, startDate, endDate });
      success();
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível criar o desafio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Criar desafio"
      subtitle="Uma meta de km pra todo mundo do clube bater junto."
      icon="trophy-outline"
      footer={<TrainlyButton title="Criar desafio" icon="checkmark" onPress={handleSave} loading={saving} />}
    >
      <TrainlyInput label="Título" placeholder="Ex: Desafio 30km de Outubro" value={title} onChangeText={setTitle} />
      <TrainlyInput
        label="Descrição (opcional)"
        placeholder="Regras, prêmio, combinado..."
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TrainlyInput
        label="Meta por membro (km)"
        placeholder="30"
        keyboardType="decimal-pad"
        value={goalKm}
        onChangeText={setGoalKm}
      />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TrainlyInput
            label="Início (AAAA-MM-DD)"
            placeholder="2026-10-01"
            value={startDate}
            onChangeText={(text) => setStartDate(maskDateInput(text, startDate))}
            keyboardType="number-pad"
            maxLength={10}
            autoCapitalize="none"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TrainlyInput
            label="Fim (AAAA-MM-DD)"
            placeholder="2026-10-31"
            value={endDate}
            onChangeText={(text) => setEndDate(maskDateInput(text, endDate))}
            keyboardType="number-pad"
            maxLength={10}
            autoCapitalize="none"
          />
        </View>
      </View>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
});
