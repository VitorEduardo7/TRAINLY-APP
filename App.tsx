import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { APP_FONTS, FontsReadyContext } from './src/theme/fonts';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AnimatedSplash } from './src/components/AnimatedSplash';

// Segura a splash nativa até a animada (em JS) estar desenhada por cima —
// sem isso, entre uma e outra aparecia um quadro vazio.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Trava de segurança: se algo quebrar antes da primeira tela aparecer, a
// splash nativa some sozinha em alguns segundos (e o erro fica visível) em
// vez de o app parecer "travado no logo" pra sempre.
const nativeSplashFailsafe = setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 5000);

/** Fonte que demora mais que isso (rede lenta no Expo Go) não segura o app. */
const FONT_WAIT_MS = 3500;
/**
 * Sessão que demora mais que isso (internet ruim) também não: a splash sai e
 * aparece o indicador de carregamento de sempre, em vez do logo parado.
 */
const AUTH_WAIT_MS = 8000;

export default function App() {
  const [fontsLoaded, fontError] = useFonts(APP_FONTS);
  const [fontWaitOver, setFontWaitOver] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFontWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* A Inter só é aplicada quando carregou de verdade; se falhar ou
            demorar, o app segue com a fonte do sistema e troca quando chegar. */}
        <FontsReadyContext.Provider value={fontsLoaded}>
          <AuthProvider>
            <AppShell fontsSettled={fontsLoaded || !!fontError || fontWaitOver} />
          </AuthProvider>
        </FontsReadyContext.Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppShell({ fontsSettled }: { fontsSettled: boolean }) {
  const { mode } = useTheme();
  const { loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [authWaitOver, setAuthWaitOver] = useState(false);
  const nativeHidden = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setAuthWaitOver(true), AUTH_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  // A splash animada já está desenhada (idêntica à nativa): troca uma pela outra.
  const hideNativeSplash = useCallback(() => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    clearTimeout(nativeSplashFailsafe);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Ícones da barra de status seguem o tema DO APP, não o do celular —
          antes, tema escuro no app + celular no claro deixava o relógio
          preto em cima do fundo preto. */}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
      {!splashDone && (
        <AnimatedSplash
          ready={fontsSettled && (!loading || authWaitOver)}
          onLayout={hideNativeSplash}
          onFinish={() => {
            hideNativeSplash();
            setSplashDone(true);
          }}
        />
      )}
    </View>
  );
}
