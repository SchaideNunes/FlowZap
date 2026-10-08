import { createClient, SupabaseClient } from '@supabase/supabase-js';

const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

let supabaseInstance: SupabaseClient | null = null;
let configured = false;

/**
 * Remove espaços e aspas que costumam vir junto ao colar valores em painéis de deploy.
 */
function cleanEnvValue(value: string | undefined): string {
  return (value || '').trim().replace(/^["']+|["']+$/g, '').trim();
}

function createWaitingClient(): SupabaseClient {
  return createClient(
    'https://placeholder.supabase.co',
    'placeholder-service-key-waiting-for-env',
    CLIENT_OPTIONS
  );
}

/**
 * Indica se o cliente real do Supabase foi inicializado com credenciais válidas.
 */
export function isSupabaseConfigured(): boolean {
  return configured;
}

/**
 * Nunca lança exceção: com variáveis ausentes ou inválidas devolve um cliente em espera,
 * para que a falta de configuração não derrube o processo/função no boot.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = cleanEnvValue(process.env.SUPABASE_URL);
  const supabaseKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados no ambiente. Inicializando cliente em espera.');
    return createWaitingClient();
  }

  const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

  try {
    supabaseInstance = createClient(cleanUrl, supabaseKey, CLIENT_OPTIONS);
    configured = true;
    return supabaseInstance;
  } catch (err) {
    console.error(
      '[Supabase] SUPABASE_URL inválida (deve começar com https://). Inicializando cliente em espera.',
      err instanceof Error ? err.message : err
    );
    return createWaitingClient();
  }
}
