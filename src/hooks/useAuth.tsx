import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types/models';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Pede a troca do e-mail de login. O Supabase manda um código de 6 dígitos
   * pro endereço NOVO — a troca só vale de verdade depois de confirmada com
   * `confirmEmailChange`. Sem deep link configurado no app (bare React
   * Native/Expo), um link de confirmação clicado no e-mail abriria o
   * navegador e não teria como voltar pro app com a sessão pronta — por isso
   * o fluxo aqui é todo por código, resolvido dentro do próprio app.
   */
  updateEmail: (newEmail: string) => Promise<void>;
  /**
   * Confirma a troca de e-mail pedida em `updateEmail`, com o código de 6
   * dígitos recebido no endereço novo.
   */
  confirmEmailChange: (newEmail: string, code: string) => Promise<void>;
  /** Troca a senha. Exige sessão ativa (já é o caso de quem está logado e chegou até a tela de Configurações) — não pede a senha atual de novo, mesmo padrão de outros apps que confiam na sessão já autenticada. Some efeito na hora: não precisa de confirmação por e-mail. */
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string, retry = true) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data as Profile);
      return;
    }
    // O perfil é criado por uma trigger no banco logo após o cadastro. Em
    // conexões lentas o evento de login pode chegar um instante antes dessa
    // trigger terminar — sem essa nova tentativa, o app ficava com o perfil
    // vazio pra sempre até reiniciar.
    if (retry && error) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await loadProfile(userId, false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) loadProfile(newSession.user.id);
      else setProfile(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Recomendação da própria documentação do Supabase para apps mobile: o
  // timer de renovação automática do token só deve rodar com o app em primeiro
  // plano. Sem isso, o app minimizado por mais tempo que a validade do token
  // (~1h) volta com uma sessão vencida, e as primeiras chamadas ao Supabase
  // falham até o próximo ciclo de renovação se ajustar sozinho.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateEmail = async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
  };

  const confirmEmailChange = async (newEmail: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: newEmail, token: code, type: 'email_change' });
    if (error) throw error;
    // O e-mail só muda de verdade depois desse `verifyOtp` — busca a sessão
    // de novo pra já refletir o endereço novo na tela sem precisar relogar.
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    // Garante que a sessão local já reflete os tokens novos emitidos pela
    // troca de senha, em vez de esperar o próximo refresh automático.
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile,
        signIn,
        signUp,
        signOut,
        updateEmail,
        confirmEmailChange,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
