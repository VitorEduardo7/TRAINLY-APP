import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { ChipSelector } from './ChipSelector';
import { FormSheet } from './FormSheet';
import { PhotoField, PhotoValue } from './PhotoField';
import { requestAchievementCheck } from './AchievementCelebration';
import { Text } from './Typography';
import { success } from '../lib/haptics';
import { maskDateInput } from '../lib/textMask';
import { PickedImage } from '../lib/photoUpload';
import { Activity, ActivityType } from '../types/models';

const TYPES: ActivityType[] = ['Corrida', 'Ciclismo', 'Natação', 'Caminhada'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Data local (não UTC) de hoje, no formato AAAA-MM-DD — usada como valor
// padrão do campo de data do formulário.
function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function numberText(n: number | null | undefined): string {
  if (n == null) return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

export interface ActivityFormInput {
  type: ActivityType;
  title?: string;
  distanceKm: number;
  durationSec: number;
  heartRate?: number | null;
  elevationM?: number | null;
  date?: string | null;
  /** Ao registrar: foto nova ou nada. Ao editar: `undefined` = não mexeu; `null` = tirou. */
  photo?: PickedImage | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Registrar um treino novo — devolve o XP ganho. */
  onSave?: (input: ActivityFormInput) => Promise<number>;
  /** Editar `editing` (o mesmo formulário, já preenchido). */
  editing?: Activity | null;
  onUpdate?: (activity: Activity, input: ActivityFormInput) => Promise<void>;
}

/**
 * Formulário de treino: registrar um feito sem o GPS do app, ou editar um que
 * já existe (igual ao site). Tem foto opcional (`activity-photos`).
 */
export function RegisterActivityModal({ visible, onClose, onSave, editing, onUpdate }: Props) {
  const { colors } = useTheme();
  const isEdit = !!editing;
  const [type, setType] = useState<ActivityType>('Corrida');
  const [title, setTitle] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [elevation, setElevation] = useState('');
  const [date, setDate] = useState(todayLocalISO());
  const [photo, setPhoto] = useState<PhotoValue | null>(null);
  const [saving, setSaving] = useState(false);

  // Ao abrir pra editar, preenche com o que já está salvo.
  useEffect(() => {
    if (!visible || !editing) return;
    setType(editing.type);
    setTitle(editing.title ?? '');
    setDistance(numberText(Number(editing.distance_km)));
    setDuration(numberText(editing.duration_sec / 60));
    setHeartRate(editing.heart_rate ? String(editing.heart_rate) : '');
    setElevation(editing.elevation_m ? String(editing.elevation_m) : '');
    setPhoto(editing.photo_url ? { uri: editing.photo_url } : null);
  }, [visible, editing]);

  const reset = () => {
    setType('Corrida');
    setTitle('');
    setDistance('');
    setDuration('');
    setHeartRate('');
    setElevation('');
    setDate(todayLocalISO());
    setPhoto(null);
  };

  const handleSave = async () => {
    const distanceKm = parseFloat(distance.replace(',', '.'));
    const durationMin = parseFloat(duration.replace(',', '.'));
    if (!distanceKm || distanceKm <= 0 || !durationMin || durationMin <= 0) {
      Alert.alert('Trainly', 'Informe distância e duração válidas.');
      return;
    }
    const trimmedDate = date.trim();
    if (!isEdit) {
      if (!DATE_RE.test(trimmedDate)) {
        Alert.alert('Trainly', 'Data inválida — use o formato AAAA-MM-DD (ex: 2026-09-19).');
        return;
      }
      if (trimmedDate > todayLocalISO()) {
        Alert.alert('Trainly', 'A data não pode ser no futuro.');
        return;
      }
    }
    const input: ActivityFormInput = {
      type,
      title: title.trim() || undefined,
      distanceKm,
      durationSec: Math.round(durationMin * 60),
      heartRate: heartRate ? parseInt(heartRate, 10) : null,
      elevationM: elevation ? parseInt(elevation, 10) : null,
    };
    setSaving(true);
    try {
      if (isEdit && editing && onUpdate) {
        // Foto: só manda se mudou (trocou por uma nova ou tirou).
        const before = editing.photo_url ?? null;
        if (photo?.picked) input.photo = photo.picked;
        else if (!photo && before) input.photo = null;
        await onUpdate(editing, input);
        success();
        onClose();
        return;
      }
      if (!onSave) return;
      const xp = await onSave({
        ...input,
        photo: photo?.picked ?? null,
        // Só manda uma data explícita quando é retroativa. Pra "hoje" (o caso
        // mais comum), deixa o banco usar o default now() — igual a uma
        // corrida por GPS — em vez de um horário fixo (meio-dia). Isso evita
        // qualquer diferença de "recência" entre um registro manual de hoje
        // e uma corrida rastreada na hora ao ordenar por data.
        date: trimmedDate === todayLocalISO() ? undefined : trimmedDate,
      });
      success();
      reset();
      onClose();
      // Espera a gaveta fechar: no iOS um alerta aberto junto com o <Modal>
      // some com ele, sem a pessoa ver.
      setTimeout(
        () =>
          Alert.alert(
            'Trainly',
            `Atividade salva! Você ganhou ${xp} XP.`,
            [{ text: 'OK', onPress: () => requestAchievementCheck(true) }],
            { cancelable: true, onDismiss: () => requestAchievementCheck(true) },
          ),
        400,
      );
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? 'Editar atividade' : 'Registrar atividade'}
      subtitle={
        isEdit ? 'O XP é recalculado com os números novos.' : 'Um treino feito sem o GPS do app — ele também vale XP.'
      }
      icon={isEdit ? 'create-outline' : 'add'}
      footer={
        <TrainlyButton
          title={isEdit ? 'Salvar alterações' : 'Salvar atividade'}
          icon="checkmark"
          onPress={handleSave}
          loading={saving}
        />
      }
    >
      <Text style={[styles.label, { color: colors.textMuted }]}>Tipo</Text>
      <ChipSelector options={TYPES} value={type} onChange={setType} style={styles.typeRow} />

      <TrainlyInput
        label="Título / legenda (opcional)"
        placeholder="Ex: Corrida matinal no parque"
        value={title}
        onChangeText={setTitle}
        returnKeyType="next"
      />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TrainlyInput
            label="Distância (km)"
            placeholder="10.0"
            keyboardType="decimal-pad"
            value={distance}
            onChangeText={setDistance}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TrainlyInput
            label="Duração (min)"
            placeholder="45"
            keyboardType="decimal-pad"
            value={duration}
            onChangeText={setDuration}
          />
        </View>
      </View>

      {!isEdit && (
        <TrainlyInput
          label="Data (AAAA-MM-DD)"
          labelRight={
            date !== todayLocalISO() ? (
              <Text onPress={() => setDate(todayLocalISO())} style={[styles.todayLink, { color: colors.primary }]}>
                Usar hoje
              </Text>
            ) : undefined
          }
          placeholder={todayLocalISO()}
          value={date}
          onChangeText={(text) => setDate(maskDateInput(text, date))}
          keyboardType="number-pad"
          maxLength={10}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TrainlyInput
            label="FC (bpm, opcional)"
            placeholder="150"
            keyboardType="number-pad"
            value={heartRate}
            onChangeText={setHeartRate}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TrainlyInput
            label="Elevação (m, opcional)"
            placeholder="30"
            keyboardType="number-pad"
            value={elevation}
            onChangeText={setElevation}
          />
        </View>
      </View>

      <PhotoField label="Foto do treino (opcional)" value={photo} onChange={setPhoto} />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
  typeRow: { marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  todayLink: { fontSize: 12, fontWeight: '700' },
});
