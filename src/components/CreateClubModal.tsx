import React, { useState } from 'react';
import { Alert } from 'react-native';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { FormSheet } from './FormSheet';
import { success } from '../lib/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<unknown>;
}

export function CreateClubModal({ visible, onClose, onSave }: Props) {
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
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Criar clube"
      subtitle="Treine com a sua turma e dispute a Guerra de Clã."
      icon="people-outline"
      footer={<TrainlyButton title="Criar clube" icon="checkmark" onPress={handleSave} loading={saving} />}
    >
      <TrainlyInput label="Nome do clube" placeholder="Ex: Corredores da Vila" value={name} onChangeText={setName} />
      <TrainlyInput
        label="Descrição (opcional)"
        placeholder="Do que esse clube trata?"
        value={description}
        onChangeText={setDescription}
        multiline
      />
    </FormSheet>
  );
}
