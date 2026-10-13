import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { TrainlyInput } from '../components/TrainlyInput';
import { TrainlyButton } from '../components/TrainlyButton';
import { FadeIn, prefersReducedMotion } from '../components/Motion';
import { Text } from '../components/Typography';
import { TrackLoop } from '../components/LapTrack';
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView';
import { selection } from '../lib/haptics';
import { describeConnectionProblem, diagnoseConnection } from '../lib/connection';
import { SUPABASE_CONFIGURED } from '../lib/supabaseConfig';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MARK_ON_DARK = require('../../assets/brand/logo-mark-on-dark.png');
const MARK_ON_LIGHT = require('../../assets/brand/logo-mark-on-light.png');
const WORD_ON_DARK = require('../../assets/brand/wordmark-on-dark.png');
const WORD_ON_LIGHT = require('../../assets/brand/wordmark-on-light.png');
const GLOW = require('../../assets/brand/glow.png');

// O Supabase Auth devolve as mensagens de erro em inglês — traduz as mais
// comuns pra manter o app consistente (todo o resto da interface é em
// português). Cai no texto original se não reconhecer a mensagem.
function translateAuthError(err: any): string {
  const msg: string = err?.message ?? '';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (lower.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).';
  if (lower.includes('user already registered')) return 'Já existe uma conta com esse e-mail — tente entrar em vez de cadastrar.';
  if (lower.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (lower.includes('unable to validate email') || lower.includes('invalid format')) return 'Digite um e-mail válido.';
  if (lower.includes('network') || lower.includes('fetch')) return 'Não foi possível conectar — confira sua internet.';
  if (lower.includes('rate limit')) return 'Muitas tentativas seguidas — espere um pouco e tente de novo.';
  return msg || 'Não foi possível continuar.';
}

/**
 * Falha de rede/servidor (o pedido nem chegou ao Supabase, ou voltou sem uma
 * resposta de login válida) — diferente de "senha errada", que é resposta
 * normal do servidor.
 */
function isConnectionError(err: any): boolean {
  const name = String(err?.name ?? '');
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    name === 'AuthRetryableFetchError' ||
    name === 'AuthUnknownError' ||
    err?.status === 540 ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('json')
  );
}

export function LoginScreen() {
  const { colors, mode: theme } = useTheme();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (next: 'login' | 'register') => {
    if (next === mode) return;
    selection();
    setMode(next);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || (mode === 'register' && !name.trim())) {
      Alert.alert('Trainly', 'Preencha todos os campos obrigatórios.');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      Alert.alert('Trainly', 'Digite um e-mail válido.');
      return;
    }
    if (mode === 'register') {
      if (password.length < 6) {
        Alert.alert('Trainly', 'A senha precisa ter pelo menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Trainly', 'As senhas não são iguais.');
        return;
      }
    }
    if (!SUPABASE_CONFIGURED) {
      Alert.alert('Trainly', describeConnectionProblem('not-configured'));
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(trimmedEmail, password);
      } else {
        await signUp(name.trim(), trimmedEmail, password);
        Alert.alert('Trainly', 'Conta criada! Verifique seu e-mail se a confirmação estiver ativa.');
      }
    } catch (err: any) {
      // Erro de conexão: descobre a causa de verdade (sem .env, banco
      // pausado, sem internet...) em vez do genérico "confira sua internet".
      if (isConnectionError(err)) {
        const problem = await diagnoseConnection();
        Alert.alert('Trainly', describeConnectionProblem(problem));
      } else {
        Alert.alert('Trainly', translateAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const dark = theme === 'dark';
  const { width: windowWidth } = useWindowDimensions();
  // Em tablet/tela larga o conteúdo fica numa coluna central, não esticado.
  const columnWidth = Math.min(windowWidth, 460) - 48;
  const register = mode === 'register';

  return (
    // Tela fora da tab navigator — não tem tab bar embaixo, então cobre topo e fundo.
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Image source={GLOW} style={[styles.glow, { opacity: dark ? 0.5 : 0.18 }]} resizeMode="contain" />
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <KeyboardAwareScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ width: columnWidth, alignSelf: 'center' }}>
            <FadeIn style={styles.hero} offset={16} duration={600}>
              <TrackLoop width={columnWidth}>
                <Image source={dark ? MARK_ON_DARK : MARK_ON_LIGHT} style={styles.mark} resizeMode="contain" />
                <Image source={dark ? WORD_ON_DARK : WORD_ON_LIGHT} style={styles.wordmark} resizeMode="contain" />
              </TrackLoop>
            </FadeIn>

            <FadeIn delay={90} offset={10}>
              <Text style={[styles.headline, { color: colors.textPrimary }]}>
                Treine. <Text style={[styles.headline, { color: colors.goldText }]}>Suba de nível.</Text>
              </Text>
              <Text style={[styles.subhead, { color: colors.textMuted }]}>
                Cada treino vira XP: suba de patente, mantenha a sequência e dispute com os amigos.
              </Text>
            </FadeIn>

            <FadeIn delay={170} offset={12}>
              <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ModeSwitch mode={mode} onChange={switchMode} />

                {!SUPABASE_CONFIGURED && (
                  <View style={[styles.setupWarn, { borderColor: withAlpha(colors.danger, 0.5), backgroundColor: withAlpha(colors.danger, 0.1) }]}>
                    <Ionicons name="warning-outline" size={18} color={colors.danger} />
                    <Text style={[styles.setupWarnText, { color: colors.textPrimary }]}>
                      Falta o arquivo <Text style={{ fontWeight: '700' }}>.env</Text> com os dados do Supabase nesta pasta do
                      projeto — sem ele o app não acha o banco de dados. Veja o README, Passo 1.
                    </Text>
                  </View>
                )}

                {register && (
                  <FadeIn key="name" offset={8} duration={300}>
                    <TrainlyInput
                      label="Nome completo"
                      placeholder="Ex: Miguel Bizerra"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      autoComplete="name"
                      textContentType="name"
                      icon="person-outline"
                    />
                  </FadeIn>
                )}

                <TrainlyInput
                  label="E-mail"
                  placeholder="seu@email.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  icon="mail-outline"
                />

                <TrainlyInput
                  label="Senha"
                  placeholder={register ? 'Mínimo 6 caracteres' : '••••••••'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType={register ? 'next' : 'go'}
                  onSubmitEditing={register ? undefined : handleSubmit}
                  icon="lock-closed-outline"
                />

                {register && (
                  <FadeIn key="confirm" offset={8} duration={300}>
                    <TrainlyInput
                      label="Confirmar senha"
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      returnKeyType="go"
                      onSubmitEditing={handleSubmit}
                      icon="shield-checkmark-outline"
                    />
                  </FadeIn>
                )}

                <View style={{ marginTop: 4 }}>
                  <TrainlyButton
                    title={register ? 'Criar minha conta grátis' : 'Entrar na minha conta'}
                    icon={register ? 'person-add-outline' : 'arrow-forward'}
                    size="lg"
                    onPress={handleSubmit}
                    loading={loading}
                  />
                </View>
              </View>
            </FadeIn>

            <Text style={[styles.footer, { color: colors.textMuted }]}>
              {register ? 'Já tem uma conta? ' : 'Ainda não tem conta? '}
              <Text onPress={() => switchMode(register ? 'login' : 'register')} style={{ color: colors.primary, fontWeight: '700' }}>
                {register ? 'Entrar' : 'Cadastre-se'}
              </Text>
            </Text>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Seletor "Entrar / Criar conta" com um fundo que desliza até a opção ativa. */
function ModeSwitch({ mode, onChange }: { mode: 'login' | 'register'; onChange: (m: 'login' | 'register') => void }) {
  const { colors, mode: theme } = useTheme();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(mode === 'login' ? 0 : 1)).current;

  useEffect(() => {
    const to = mode === 'login' ? 0 : 1;
    if (prefersReducedMotion()) {
      x.setValue(to);
      return;
    }
    Animated.spring(x, { toValue: to, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [mode, x]);

  const segment = width > 0 ? (width - 8) / 2 : 0;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.switch, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="tablist"
    >
      {segment > 0 && (
        <Animated.View
          style={[
            styles.switchThumb,
            {
              width: segment,
              backgroundColor: withAlpha(colors.primary, theme === 'dark' ? 0.22 : 0.12),
              borderColor: withAlpha(colors.primary, 0.55),
              transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, segment] }) }],
            },
          ]}
        />
      )}
      {(['login', 'register'] as const).map((m) => {
        const active = mode === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, { color: active ? colors.textPrimary : colors.textMuted }]}>
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingVertical: 20, justifyContent: 'center' },
  glow: { position: 'absolute', alignSelf: 'center', width: 520, height: 520, top: -150 },
  hero: { alignItems: 'center', marginBottom: 22 },
  mark: { width: 96, height: 64 },
  wordmark: { width: 118, height: 15, marginTop: 8 },
  headline: { fontSize: 34, fontWeight: '900', fontStyle: 'italic', textAlign: 'center', lineHeight: 38 },
  subhead: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 8 },
  formCard: { borderWidth: 1, borderRadius: 22, padding: 16, paddingTop: 16, marginTop: 24 },
  switch: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1, marginBottom: 18 },
  switchThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  footer: { textAlign: 'center', marginTop: 20, fontSize: 13.5, fontWeight: '500' },
  setupWarn: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  setupWarnText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
