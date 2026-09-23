import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { Text } from './Typography';
import { Profile } from '../types/models';

interface Props {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSave: (fields: { name: string; location: string; bio: string; monthlyGoalKm: number }) => Promise<void>;
}

export function EditProfileModal({ visible, profile, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setLocation(profile.location ?? '');
      setBio(profile.bio ?? '');
      setGoal(String(profile.monthly_goal_km ?? 50));
    }
  }, [profile, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Trainly', 'O nome não pode ficar vazio.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        location: location.trim(),
        bio: bio.trim(),
        monthlyGoalKm: parseInt(goal, 10) || 50,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível salvar o perfil.');
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
            <Text style={[styles.title, { color: colors.textPrimary }]}>Editar Perfil</Text>
            <TrainlyInput label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" />
            <TrainlyInput
              label="Localização (opcional)"
              value={location}
              onChangeText={setLocation}
              placeholder="Ex: São Paulo, SP"
            />
            <TrainlyInput
              label="Bio (opcional)"
              value={bio}
              onChangeText={setBio}
              placeholder="Fale um pouco sobre você"
              multiline
            />
            <TrainlyInput
              label="Meta mensal (km)"
              value={goal}
              onChangeText={setGoal}
              keyboardType="number-pad"
              placeholder="50"
            />
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <TrainlyButton title="Cancelar" variant="secondary" onPress={onClose} />
              </View>
              <View style={{ flex: 1 }}>
                <TrainlyButton title="Salvar" onPress={handleSave} loading={saving} />
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
