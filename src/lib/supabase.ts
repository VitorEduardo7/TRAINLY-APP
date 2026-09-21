import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Preencha esses dois valores depois de criar o projeto em supabase.com
// Veja o README na raiz do projeto para o passo a passo.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'SUA-CHAVE-ANON-AQUI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
