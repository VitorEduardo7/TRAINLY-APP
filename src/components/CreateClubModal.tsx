import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { Text } from './Typography';
import { success } from '../lib/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<unknown>;
}

export function CreateClubModal({ visible, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Trainly', 'Dê um nome ao clube.');
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      success();
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível criar o clube.');
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
            <Text style={[styles.title, { color: colors.textPrimary }]}>Criar Clube</Text>

            <TrainlyInput label="Nome do clube" placeholder="Ex: Corredores da Vila" value={name} onChangeText={setName} />
            <TrainlyInput
              label="Descrição (opcional)"
              placeholder="Do que esse clube trata?"
              value={description}
              onChangeText={setDescription}
              multiline
            />

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
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingTop: 12, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
