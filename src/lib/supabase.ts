import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
// Os dois valores vêm do `.env` (ver README, Passo 1, e `supabaseConfig.ts`).
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseConfig';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
