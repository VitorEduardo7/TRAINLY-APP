import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { maskDateInput } from '../lib/textMask';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (input: { title: string; description?: string; goalKm: number; startDate: string; endDate: string }) => Promise<unknown>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function CreateChallengeModal({ visible, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível criar o desafio.');
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
            <Text style={[styles.title, { color: colors.textPrimary }]}>Criar Desafio</Text>

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

            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <TrainlyButton title="Cancelar" variant="secondary" onPress={onClose} />
              </View>
              <View style={{ flex: 1 }}>
                <TrainlyButton title="Criar" onPress={handleSave} loading={saving} />
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
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, maxHeight: '88%' },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
