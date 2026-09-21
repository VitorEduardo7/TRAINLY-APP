import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { TrainlyInput } from '../components/TrainlyInput';
import { TrainlyButton } from '../components/TrainlyButton';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const { colors } = useTheme();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (next: 'login' | 'register') => {
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

  return (
    // Tela fora da tab navigator — não tem tab bar embaixo, então cobre topo e fundo.
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={[styles.brand, { color: colors.textPrimary }]}>
            Train<Text style={{ color: colors.primary }}>ly</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Treine. Suba de Nível.
          </Text>
        </View>

        <View style={styles.tabs}>
          <TabButton label="Entrar" active={mode === 'login'} onPress={() => switchMode('login')} />
          <TabButton
            label="Criar Conta"
            active={mode === 'register'}
            onPress={() => switchMode('register')}
          />
        </View>

        {mode === 'register' && (
          <TrainlyInput
            label="Nome completo"
            placeholder="Ex: Miguel Bizerra"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TrainlyInput
          label="E-mail"
          placeholder="seu@email.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TrainlyInput
          label="Senha"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {mode === 'register' && (
          <TrainlyInput
            label="Confirmar senha"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        )}

        <TrainlyButton
          title={mode === 'login' ? 'Entrar na minha conta' : 'Criar minha conta grátis'}
          onPress={handleSubmit}
          loading={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Text
      onPress={onPress}
      style={[
        styles.tabBtn,
        {
          color: active ? colors.primary : colors.textMuted,
          borderBottomColor: active ? colors.primary : 'transparent',
        },
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 40 },
  brand: { fontSize: 34, fontWeight: '900' },
  tagline: { fontSize: 15, marginTop: 6, fontWeight: '600' },
  tabs: { flexDirection: 'row', marginBottom: 24, gap: 24 },
  tabBtn: {
    fontSize: 15,
    fontWeight: '700',
    paddingBottom: 8,
    borderBottomWidth: 2,
  },
});
