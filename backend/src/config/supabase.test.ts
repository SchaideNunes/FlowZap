import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createClientMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

const ORIGINAL_ENV = { ...process.env };

async function loadModule() {
  vi.resetModules();
  return import('./supabase.js');
}

describe('config/supabase getSupabaseClient', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    createClientMock.mockImplementation((url: string) => {
      if (!/^https?:\/\//.test(url)) {
        throw new Error('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.');
      }
      return { url };
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('usa um cliente em espera quando as variáveis não estão configuradas', async () => {
    const { getSupabaseClient, isSupabaseConfigured } = await loadModule();

    expect(() => getSupabaseClient()).not.toThrow();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('não derruba o boot quando SUPABASE_URL é inválida (sem https://)', async () => {
    process.env.SUPABASE_URL = 'meuprojeto.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave';
    const { getSupabaseClient, isSupabaseConfigured } = await loadModule();

    expect(() => getSupabaseClient()).not.toThrow();
    expect(isSupabaseConfigured()).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('remove aspas, espaços e /rest/v1/ colados na URL e na chave', async () => {
    process.env.SUPABASE_URL = '  "https://meuprojeto.supabase.co/rest/v1/"  ';
    process.env.SUPABASE_SERVICE_ROLE_KEY = ' "chave-secreta" ';
    const { getSupabaseClient, isSupabaseConfigured } = await loadModule();

    getSupabaseClient();

    expect(createClientMock).toHaveBeenCalledWith(
      'https://meuprojeto.supabase.co',
      'chave-secreta',
      expect.any(Object)
    );
    expect(isSupabaseConfigured()).toBe(true);
  });
});
