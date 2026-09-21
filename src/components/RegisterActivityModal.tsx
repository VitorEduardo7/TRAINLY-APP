import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { maskDateInput } from '../lib/textMask';
import { ActivityType } from '../types/models';

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

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (input: {
    type: ActivityType;
    title?: string;
    distanceKm: number;
    durationSec: number;
    heartRate?: number | null;
    elevationM?: number | null;
    date?: string | null;
  }) => Promise<number>;
}

export function RegisterActivityModal({ visible, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<ActivityType>('Corrida');
  const [title, setTitle] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [elevation, setElevation] = useState('');
  const [date, setDate] = useState(todayLocalISO());
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setType('Corrida');
    setTitle('');
    setDistance('');
    setDuration('');
    setHeartRate('');
    setElevation('');
    setDate(todayLocalISO());
  };

  const handleSave = async () => {
    const distanceKm = parseFloat(distance.replace(',', '.'));
    const durationMin = parseFloat(duration.replace(',', '.'));
    if (!distanceKm || distanceKm <= 0 || !durationMin || durationMin <= 0) {
      Alert.alert('Trainly', 'Informe distância e duração válidas.');
      return;
    }
    const trimmedDate = date.trim();
    if (!DATE_RE.test(trimmedDate)) {
      Alert.alert('Trainly', 'Data inválida — use o formato AAAA-MM-DD (ex: 2026-09-19).');
      return;
    }
    if (trimmedDate > todayLocalISO()) {
      Alert.alert('Trainly', 'A data não pode ser no futuro.');
      return;
    }
    setSaving(true);
    try {
      const xp = await onSave({
        type,
        title: title || undefined,
        distanceKm,
        durationSec: Math.round(durationMin * 60),
        heartRate: heartRate ? parseInt(heartRate, 10) : null,
        elevationM: elevation ? parseInt(elevation, 10) : null,
        // Só manda uma data explícita quando é retroativa. Pra "hoje" (o caso
        // mais comum), deixa o banco usar o default now() — igual a uma
        // corrida por GPS — em vez de um horário fixo (meio-dia). Isso evita
        // qualquer diferença de "recência" entre um registro manual de hoje
        // e uma corrida rastreada na hora ao ordenar o feed por data.
        date: trimmedDate === todayLocalISO() ? undefined : trimmedDate,
      });
      Alert.alert('Trainly', `Atividade salva! Você ganhou ${xp} XP.`);
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível salvar.');
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
            <Text style={[styles.title, { color: colors.textPrimary }]}>Registrar Atividade</Text>

            <Text style={[styles.label, { color: colors.textMuted }]}>Tipo</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => (
                <Text
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: t === type ? colors.primary : colors.border,
                      color: t === type ? colors.primary : colors.textMuted,
                      backgroundColor: t === type ? `${colors.primary}22` : 'transparent',
                    },
                  ]}
                >
                  {t}
                </Text>
              ))}
            </View>

            <TrainlyInput
              label="Título / legenda (opcional)"
              placeholder="Ex: Corrida matinal no parque"
              value={title}
              onChangeText={setTitle}
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
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, maxHeight: '88%' },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: 12 },
  todayLink: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
