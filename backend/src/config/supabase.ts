import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseInstance && supabaseUrl && supabaseKey) {
    return supabaseInstance;
  }

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados no ambiente. Inicializando cliente em espera.');
    return createClient('https://placeholder.supabase.co', 'placeholder-service-key-waiting-for-env', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  const cleanUrl = supabaseUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

  supabaseInstance = createClient(cleanUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseInstance;
}
