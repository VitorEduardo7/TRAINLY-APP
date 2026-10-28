import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Avatar } from './Avatar';
import { PressableScale } from './Motion';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { FormSheet } from './FormSheet';
import { ChipSelector } from './ChipSelector';
import { Text } from './Typography';
import { GoalType, Profile } from '../types/models';
import { pickAndUploadAvatar, pickAndUploadCover } from '../lib/avatarUpload';
import { tapLight } from '../lib/haptics';
import { GOAL_TYPE_LABEL, goalTypeOf, goalValueOf } from '../lib/goal';

export interface ProfileEditFields {
  name: string;
  location: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  goalType: GoalType;
  goalValue: number;
}

interface Props {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSave: (fields: ProfileEditFields) => Promise<void>;
}

const GOAL_OPTIONS = ['Km', 'Atividades', 'Horas'] as const;
const GOAL_BY_LABEL: Record<(typeof GOAL_OPTIONS)[number], GoalType> = { Km: 'km', Atividades: 'activities', Horas: 'hours' };
const LABEL_BY_GOAL: Record<GoalType, (typeof GOAL_OPTIONS)[number]> = { km: 'Km', activities: 'Atividades', hours: 'Horas' };

export function EditProfileModal({ visible, profile, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('km');
  const [goal, setGoal] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [saving, setSaving] = useState(false);
  // A capa e a meta por tipo vêm do site (site_integration.sql). Num banco
  // sem essas colunas, os campos ficam escondidos em vez de dar erro ao salvar.
  const hasSiteFields = !!profile && 'monthly_goal_type' in profile;

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setLocation(profile.location ?? '');
      setBio(profile.bio ?? '');
      setGoalType(goalTypeOf(profile));
      setGoal(String(goalValueOf(profile)).replace('.', ','));
      setAvatarUrl(profile.avatar_url ?? null);
      setCoverUrl(profile.cover_url ?? null);
    }
  }, [profile, visible]);

  const changeImage = async (kind: 'avatar' | 'cover') => {
    if (!profile) return;
    tapLight();
    setUploading(kind);
    try {
      const url = kind === 'avatar' ? await pickAndUploadAvatar(profile.id) : await pickAndUploadCover(profile.id);
      if (url) (kind === 'avatar' ? setAvatarUrl : setCoverUrl)(url);
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível trocar a foto.');
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Trainly', 'O nome não pode ficar vazio.');
      return;
    }
    if (bio.length > 280) {
      Alert.alert('Trainly', 'A bio pode ter no máximo 280 caracteres.');
      return;
    }
    const goalValue = parseFloat(goal.replace(',', '.'));
    if (!goalValue || goalValue <= 0) {
      Alert.alert('Trainly', 'Informe uma meta do mês maior que zero.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        location: location.trim(),
        bio: bio.trim(),
        avatarUrl,
        coverUrl,
        goalType: hasSiteFields ? goalType : 'km',
        goalValue,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Editar perfil"
      icon="person-outline"
      footer={<TrainlyButton title="Salvar perfil" icon="checkmark" onPress={handleSave} loading={saving} />}
    >
      {hasSiteFields && (
        <PressableScale
          onPress={() => changeImage('cover')}
          disabled={uploading !== null}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel="Trocar foto de capa"
          style={[styles.cover, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {coverUrl ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <View style={styles.coverChip}>
            {uploading === 'cover' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="image-outline" size={14} color="#fff" />
            )}
            <Text style={styles.coverChipText}>{coverUrl ? 'Trocar capa' : 'Adicionar capa'}</Text>
          </View>
        </PressableScale>
      )}

      <View style={[styles.photoRow, hasSiteFields && { marginTop: -40 }]}>
        <PressableScale onPress={() => changeImage('avatar')} disabled={uploading !== null} scaleTo={0.95}>
          <View>
            <Avatar name={name || '?'} uri={avatarUrl} size={78} />
            <View style={[styles.photoBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
              {uploading === 'avatar' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          </View>
        </PressableScale>
        <Text style={[styles.photoHint, { color: colors.textMuted }]} onPress={() => changeImage('avatar')}>
          Toque na foto pra trocar
        </Text>
      </View>

      <TrainlyInput label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" />
      <TrainlyInput label="Localização (opcional)" value={location} onChangeText={setLocation} placeholder="Ex: São Paulo, SP" />
      <TrainlyInput
        label="Bio (opcional)"
        labelRight={<Text style={[styles.counter, { color: colors.textMuted }]}>{bio.length}/280</Text>}
        value={bio}
        onChangeText={setBio}
        maxLength={280}
        placeholder="Fale um pouco sobre você"
        multiline
      />

      {hasSiteFields && (
        <>
          <Text style={[styles.label, { color: colors.textMuted }]}>Meta do mês em</Text>
          <ChipSelector
            options={GOAL_OPTIONS}
            value={LABEL_BY_GOAL[goalType]}
            onChange={(v) => setGoalType(GOAL_BY_LABEL[v])}
            style={{ marginBottom: 14 }}
          />
        </>
      )}
      <TrainlyInput
        label={`Meta do mês (${GOAL_TYPE_LABEL[hasSiteFields ? goalType : 'km']})`}
        value={goal}
        onChangeText={setGoal}
        keyboardType="decimal-pad"
        placeholder={goalType === 'km' ? '50' : goalType === 'activities' ? '12' : '10'}
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  cover: { height: 110, borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 0 },
  coverChip: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  coverChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  photoRow: { alignItems: 'center', marginBottom: 20 },
  photoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  photoHint: { fontSize: 12, fontWeight: '600', marginTop: 10 },
  counter: { fontSize: 11.5, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
});
