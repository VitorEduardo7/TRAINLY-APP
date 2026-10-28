import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { PickedImage } from '../lib/photoUpload';
import { success } from '../lib/haptics';
import { FormSheet } from './FormSheet';
import { PhotoField, PhotoValue } from './PhotoField';
import { TrainlyButton } from './TrainlyButton';
import { TrainlyInput } from './TrainlyInput';
import { Text } from './Typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPublish: (text: string, image: PickedImage | null) => Promise<void>;
}

const MAX = 2000;

/** "No que você está pensando?" — nova publicação (texto e/ou foto), igual ao site. */
export function CreatePostModal({ visible, onClose, onPublish }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<PhotoValue | null>(null);
  const [saving, setSaving] = useState(false);

  const publish = async () => {
    if (!text.trim() && !photo) {
      Alert.alert('Trainly', 'Escreva algo ou escolha uma foto pra publicar.');
      return;
    }
    setSaving(true);
    try {
      await onPublish(text, photo?.picked ?? null);
      success();
      setText('');
      setPhoto(null);
      onClose();
    } catch (err: any) {
      Alert.alert('Trainly', err?.message ?? 'Não foi possível publicar agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Nova publicação"
      subtitle="Só seus amigos veem, curtem e comentam."
      icon="create-outline"
      footer={<TrainlyButton title="Publicar" icon="paper-plane-outline" onPress={publish} loading={saving} />}
    >
      <TrainlyInput
        label="No que você está pensando?"
        labelRight={
          <Text style={[styles.counter, { color: text.length > MAX * 0.9 ? colors.danger : colors.textMuted }]}>
            {text.length}/{MAX}
          </Text>
        }
        placeholder="Escreva algo pros seus amigos..."
        value={text}
        onChangeText={setText}
        maxLength={MAX}
        multiline
      />
      <PhotoField label="Foto (opcional)" value={photo} onChange={setPhoto} />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  counter: { fontSize: 11.5, fontWeight: '600' },
});
