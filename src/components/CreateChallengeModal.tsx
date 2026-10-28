import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyInput } from './TrainlyInput';
import { TrainlyButton } from './TrainlyButton';
import { FormSheet } from './FormSheet';
import { ChipSelector } from './ChipSelector';
import { Text } from './Typography';
import { success } from '../lib/haptics';
import { maskDateInput } from '../lib/textMask';
import { ChallengeMetric } from '../types/models';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (input: {
    title: string;
    description?: string;
    metric: ChallengeMetric;
    goalKm: number;
    startDate: string;
    endDate: string;
  }) => Promise<unknown>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPTIONS = ['Km', 'Atividades', 'Horas', 'Dias ativos'] as const;
const METRIC_BY_OPTION: Record<(typeof OPTIONS)[number], ChallengeMetric> = {
  Km: 'km',
  Atividades: 'activities',
  Horas: 'hours',
  'Dias ativos': 'days',
};
const HINT: Record<ChallengeMetric, string> = {
  km: 'Ganha quem somar mais km no período.',
  activities: 'Ganha quem registrar mais atividades no período.',
  hours: 'Ganha quem treinar mais horas no período.',
  days: 'Ganha quem treinar em mais dias diferentes no período.',
};

/**
 * Novo desafio de clube — igual ao site: o admin escolhe o que conta (km,
 * atividades, horas ou dias ativos) e o período; vira um ranking entre os
 * membros. Em desafio de km dá pra pôr também uma meta por membro (opcional).
 */
export function CreateChallengeModal({ visible, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [option, setOption] = useState<(typeof OPTIONS)[number]>('Km');
  const [goalKm, setGoalKm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const metric = METRIC_BY_OPTION[option];

  const reset = () => {
    setTitle('');
    setDescription('');
    setOption('Km');
    setGoalKm('');
    setStartDate('');
    setEndDate('');
  };

  const handleSave = async () => {
    const goal = goalKm.trim() ? parseFloat(goalKm.replace(',', '.')) : 0;
    if (!title.trim()) {
      Alert.alert('Trainly', 'Dê um título ao desafio.');
      return;
    }
    if (metric === 'km' && goalKm.trim() && !(goal > 0)) {
      Alert.alert('Trainly', 'A meta em km precisa ser um número maior que zero (ou deixe em branco).');
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
      await onSave({ title: title.trim(), description: description.trim(), metric, goalKm: goal, startDate, endDate });
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
      subtitle="Um ranking entre os membros do clube, num período."
      icon="trophy-outline"
      footer={<TrainlyButton title="Criar desafio" icon="checkmark" onPress={handleSave} loading={saving} />}
    >
      <TrainlyInput label="Título" placeholder="Ex: Desafio de Outubro" value={title} onChangeText={setTitle} />
      <TrainlyInput
        label="Descrição (opcional)"
        placeholder="Regras, prêmio, combinado..."
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>O que conta no ranking</Text>
      <ChipSelector options={OPTIONS} value={option} onChange={setOption} />
      <Text style={[styles.hint, { color: colors.textMuted }]}>{HINT[metric]}</Text>

      {metric === 'km' && (
        <TrainlyInput
          label="Meta por membro (km, opcional)"
          placeholder="Ex: 30"
          keyboardType="decimal-pad"
          value={goalKm}
          onChangeText={setGoalKm}
        />
      )}
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
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  hint: { fontSize: 12, fontWeight: '500', marginTop: 8, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
});
