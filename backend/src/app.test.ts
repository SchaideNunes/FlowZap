import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

const ORIGINAL_ENV = { ...process.env };

async function loadApp() {
  vi.resetModules();
  const mod = await import('./app.js');
  return mod.app;
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('responde 200 e informa que o Supabase não está configurado, sem expor valores', async () => {
    const app = await loadApp();

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.supabase).toBe('nao_configurado');
    expect(JSON.stringify(res.body)).not.toMatch(/supabase\.co/);
  });

  it('não cai com SUPABASE_URL inválida e informa o problema', async () => {
    process.env.SUPABASE_URL = 'meuprojeto.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave';
    const app = await loadApp();

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.supabase).toBe('nao_configurado');
  });

  it('informa configurado quando URL e chave são válidas', async () => {
    process.env.SUPABASE_URL = 'https://meuprojeto.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave';
    const app = await loadApp();

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.supabase).toBe('configurado');
  });
});
