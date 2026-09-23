import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { TrainlyInput } from '../components/TrainlyInput';
import { TrainlyButton } from '../components/TrainlyButton';
import { FadeIn, prefersReducedMotion } from '../components/Motion';
import { Text } from '../components/Typography';
import { selection } from '../lib/haptics';

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
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(trimmedEmail, password);
      } else {
        await signUp(name.trim(), trimmedEmail, password);
        Alert.alert('Trainly', 'Conta criada! Verifique seu e-mail se a confirmação estiver ativa.');
      }
    } catch (err: any) {
      Alert.alert('Trainly', translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const dark = theme === 'dark';

  return (
    // Tela fora da tab navigator — não tem tab bar embaixo, então cobre topo e fundo.
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <FadeIn style={styles.hero} offset={20} duration={600}>
            <Image source={GLOW} style={[styles.glow, { opacity: dark ? 0.55 : 0.22 }]} resizeMode="contain" />
            <Image source={dark ? MARK_ON_DARK : MARK_ON_LIGHT} style={styles.mark} resizeMode="contain" />
            <Image source={dark ? WORD_ON_DARK : WORD_ON_LIGHT} style={styles.wordmark} resizeMode="contain" />
            <Text style={[styles.tagline, { color: colors.textMuted }]}>Treine. Suba de Nível.</Text>
          </FadeIn>

          <FadeIn delay={120}>
            <ModeSwitch mode={mode} onChange={switchMode} />
          </FadeIn>

          <FadeIn delay={200}>
            {mode === 'register' && (
              <FadeIn key="name" offset={8} duration={300}>
                <TrainlyInput
                  label="Nome completo"
                  placeholder="Ex: Miguel Bizerra"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
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
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
            />

            {mode === 'register' && (
              <FadeIn key="confirm" offset={8} duration={300}>
                <TrainlyInput
                  label="Confirmar senha"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  icon="shield-checkmark-outline"
                />
              </FadeIn>
            )}
          </FadeIn>

          <FadeIn delay={260} style={{ marginTop: 6 }}>
            <TrainlyButton
              title={mode === 'login' ? 'Entrar na minha conta' : 'Criar minha conta grátis'}
              icon={mode === 'login' ? 'log-in-outline' : 'person-add-outline'}
              onPress={handleSubmit}
              loading={loading}
            />
          </FadeIn>

          <Text style={[styles.footer, { color: colors.textMuted }]}>
            {mode === 'login' ? 'Ainda não tem conta? ' : 'Já tem uma conta? '}
            <Text
              onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
              style={{ color: colors.primary, fontWeight: '700' }}
            >
              {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
              backgroundColor: theme === 'dark' ? colors.card : '#ffffff',
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
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 34 },
  glow: { position: 'absolute', width: 300, height: 300, top: -70 },
  mark: { width: 150, height: 100 },
  wordmark: { width: 170, height: 21, marginTop: 14 },
  tagline: { fontSize: 14.5, marginTop: 12, fontWeight: '600', letterSpacing: 0.3 },
  switch: { flexDirection: 'row', padding: 4, borderRadius: 14, borderWidth: 1, marginBottom: 22 },
  switchThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segment: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  segmentText: { fontSize: 14.5, fontWeight: '700' },
  footer: { textAlign: 'center', marginTop: 22, fontSize: 13.5, fontWeight: '500' },
});
