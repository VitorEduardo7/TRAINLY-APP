import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useTheme, FontScale } from '../theme/ThemeContext';
import { ColorBlindMode } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/Card';
import { SectionTitle } from '../components/SectionTitle';
import { TrainlyInput } from '../components/TrainlyInput';
import { TrainlyButton } from '../components/TrainlyButton';
import { PressableScale, FadeIn, setManualReduceMotion, getManualReduceMotion } from '../components/Motion';
import { Text } from '../components/Typography';
import { warning, selection } from '../lib/haptics';

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  normal: 'Padrão',
  large: 'Grande',
  xlarge: 'Extra grande',
};
const FONT_SCALE_OPTIONS: FontScale[] = ['normal', 'large', 'xlarge'];

const COLOR_BLIND_LABELS: Record<Exclude<ColorBlindMode, null>, string> = {
  protanopia: 'Protanopia',
  deuteranopia: 'Deuteranopia',
  tritanopia: 'Tritanopia',
};
const COLOR_BLIND_OPTIONS: ColorBlindMode[] = [null, 'protanopia', 'deuteranopia', 'tritanopia'];

export function SettingsScreen() {
  const {
    colors,
    mode,
    toggle,
    colorBlindMode,
    setColorBlindMode,
    highContrast,
    setHighContrast,
    fontScale,
    setFontScale,
  } = useTheme();
  const { session, signOut, updateEmail, confirmEmailChange, updatePassword } = useAuth();

  const currentEmail = session?.user?.email ?? '';

  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  // Depois de pedir a troca, guarda o e-mail pendente pra mostrar o campo de
  // código — o Supabase manda um código de 6 dígitos pro endereço NOVO.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [confirmingEmail, setConfirmingEmail] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [reduceMotion, setReduceMotion] = useState(getManualReduceMotion());

  const handleSaveEmail = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Trainly', 'Digite um e-mail válido.');
      return;
    }
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      Alert.alert('Trainly', 'Esse já é o seu e-mail atual.');
      return;
    }
    setSavingEmail(true);
    try {
      await updateEmail(trimmed);
      setPendingEmail(trimmed);
      setNewEmail('');
      Alert.alert(
        'Trainly',
        `Mandamos um código de 6 dígitos para ${trimmed}. Digite ele aqui embaixo pra confirmar — até lá, seu e-mail de login continua sendo o antigo (${currentEmail}).`,
      );
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível trocar o e-mail.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleConfirmEmailCode = async () => {
    if (!pendingEmail) return;
    const trimmedCode = emailCode.trim();
    if (trimmedCode.length < 6) {
      Alert.alert('Trainly', 'Digite o código de 6 dígitos que chegou no e-mail novo.');
      return;
    }
    setConfirmingEmail(true);
    try {
      await confirmEmailChange(pendingEmail, trimmedCode);
      Alert.alert('Trainly', 'E-mail confirmado! Já pode usar o endereço novo pra entrar.');
      setPendingEmail(null);
      setEmailCode('');
    } catch (err: any) {
      Alert.alert(
        'Trainly',
        err.message ?? 'Código incorreto ou expirado. Confira o e-mail mais recente e tente de novo.',
      );
    } finally {
      setConfirmingEmail(false);
    }
  };

  const handleCancelPendingEmail = () => {
    setPendingEmail(null);
    setEmailCode('');
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Trainly', 'A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Trainly', 'As duas senhas digitadas são diferentes.');
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(newPassword);
      Alert.alert('Trainly', 'Senha alterada com sucesso. Já vale a partir de agora — use a senha nova no próximo login.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível trocar a senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    warning();
    Alert.alert('Trainly', 'Tem certeza que quer sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const onToggleReduceMotion = (v: boolean) => {
    selection();
    setReduceMotion(v);
    setManualReduceMotion(v);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <FadeIn>
        <Card>
          <SectionTitle title="Conta" />
          <Text style={[styles.currentEmailLabel, { color: colors.textMuted }]}>E-mail atual</Text>
          <Text style={[styles.currentEmail, { color: colors.textPrimary }]}>{currentEmail || 'não definido'}</Text>

          <View style={styles.divider} />

          {pendingEmail ? (
            <View>
              <Text style={[styles.pendingNotice, { color: colors.textMuted }]}>
                Troca pendente para <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{pendingEmail}</Text>.
                Digite o código de 6 dígitos que chegou nesse e-mail.
              </Text>
              <TrainlyInput
                label="Código de confirmação"
                icon="key-outline"
                value={emailCode}
                onChangeText={(t) => setEmailCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
              />
              <TrainlyButton
                title="Confirmar código"
                variant="secondary"
                onPress={handleConfirmEmailCode}
                loading={confirmingEmail}
              />
              <View style={{ marginTop: 8 }}>
                <TrainlyButton title="Cancelar troca" variant="dangerOutline" size="sm" onPress={handleCancelPendingEmail} />
              </View>
            </View>
          ) : (
            <>
              <TrainlyInput
                label="Novo e-mail"
                icon="mail-outline"
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="novo@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TrainlyButton title="Salvar novo e-mail" variant="secondary" onPress={handleSaveEmail} loading={savingEmail} />
            </>
          )}

          <View style={styles.divider} />

          <TrainlyInput
            label="Nova senha"
            icon="lock-closed-outline"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
          />
          <TrainlyInput
            label="Confirmar nova senha"
            icon="lock-closed-outline"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repita a nova senha"
            secureTextEntry
          />
          <TrainlyButton title="Salvar nova senha" variant="secondary" onPress={handleSavePassword} loading={savingPassword} />
        </Card>
      </FadeIn>

      <FadeIn delay={60}>
        <Card style={{ marginTop: 16 }}>
          <SectionTitle title="Aparência" />
          <ToggleRow
            title={mode === 'dark' ? 'Tema escuro' : 'Tema claro'}
            description="Alterna entre claro e escuro. Some sozinho se o celular já tiver um definido, mas pode ser trocado aqui a qualquer momento."
            value={mode === 'dark'}
            onChange={() => {
              selection();
              toggle();
            }}
          />
        </Card>
      </FadeIn>

      <FadeIn delay={100}>
        <Card style={{ marginTop: 16 }}>
          <SectionTitle title="Acessibilidade" />

          <Text style={[styles.fontSizeLabel, { color: colors.textMuted, marginTop: 0 }]}>Cores para daltonismo</Text>
          <Text style={[styles.colorBlindHint, { color: colors.textMuted }]}>
            Ajusta as cores de sucesso/erro/alerta, das modalidades (corrida, pedal, natação, caminhada), do streak
            (fogo/gelo) e das patentes (moldura do avatar, cor do mapa) em todo o app. Protanopia e deuteranopia
            (confusão vermelho-verde) usam paletas bem parecidas; tritanopia (confusão azul-amarelo, mais rara) usa
            uma paleta diferente.
          </Text>
          <View style={styles.fontScaleRow}>
            {COLOR_BLIND_OPTIONS.map((option) => {
              const active = option === colorBlindMode;
              const label = option ? COLOR_BLIND_LABELS[option] : 'Nenhum';
              return (
                <PressableScale
                  key={option ?? 'none'}
                  onPress={() => {
                    if (!active) selection();
                    setColorBlindMode(option);
                  }}
                  scaleTo={0.95}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.fontScaleChip,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.fontScaleLabel, { color: active ? '#ffffff' : colors.textMuted }]}>
                    {label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <View style={[styles.divider, { height: 18 }]} />

          <ToggleRow
            title="Alto contraste"
            description="Texto secundário e bordas mais fortes contra o fundo."
            value={highContrast}
            onChange={(v) => {
              selection();
              setHighContrast(v);
            }}
          />
          <ToggleRow
            title="Reduzir animações"
            description="Além do ajuste 'Reduzir movimento' do sistema — liga isso pra reduzir as animações só dentro do Trainly."
            value={reduceMotion}
            onChange={onToggleReduceMotion}
            last
          />

          <Text style={[styles.fontSizeLabel, { color: colors.textMuted }]}>Tamanho do texto</Text>
          <View style={styles.fontScaleRow}>
            {FONT_SCALE_OPTIONS.map((option) => {
              const active = option === fontScale;
              return (
                <PressableScale
                  key={option}
                  onPress={() => {
                    if (!active) selection();
                    setFontScale(option);
                  }}
                  scaleTo={0.95}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.fontScaleChip,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.fontScaleLabel, { color: active ? '#ffffff' : colors.textMuted }]}>
                    {FONT_SCALE_LABELS[option]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={140}>
        <View style={{ marginTop: 20, marginBottom: 24 }}>
          <TrainlyButton title="Sair da conta" variant="danger" onPress={handleLogout} />
        </View>
      </FadeIn>
    </ScrollView>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
  last,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.toggleRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.toggleDescription, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  currentEmailLabel: { fontSize: 12, fontWeight: '600', marginBottom: 3 },
  currentEmail: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  pendingNotice: { fontSize: 12.5, fontWeight: '500', lineHeight: 18, marginBottom: 12 },
  divider: { height: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  toggleTitle: { fontSize: 14.5, fontWeight: '700' },
  toggleDescription: { fontSize: 12, fontWeight: '500', marginTop: 3, lineHeight: 17 },
  fontSizeLabel: { fontSize: 14.5, fontWeight: '700', marginTop: 4, marginBottom: 10 },
  colorBlindHint: { fontSize: 12, fontWeight: '500', marginTop: -6, marginBottom: 10, lineHeight: 16 },
  fontScaleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  fontScaleChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  fontScaleLabel: { fontSize: 13.5, fontWeight: '600' },
});
