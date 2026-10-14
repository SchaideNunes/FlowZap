import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { getSupabaseClient } from '../config/supabase.js';
import { createApp } from '../create-app.js';
import { createMemoryRepositories } from './memory.repositories.js';
import { createDemoStore, DEMO_LOGIN } from './demo-data.js';
import { DemoWhatsAppGateway } from './demo-gateway.js';

vi.mock('../config/supabase.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../config/supabase.js')>();
  return { ...real, getSupabaseClient: vi.fn(real.getSupabaseClient) };
});

// 14/10/2026 às 15h no Brasil
const NOW = new Date('2026-10-14T18:00:00Z');

async function demoApp() {
  const store = await createDemoStore(NOW);
  const { app } = createApp({
    repositories: createMemoryRepositories(store),
    whatsAppGateway: new DemoWhatsAppGateway(() => {}),
    jwtSecret: 'segredo-so-do-teste',
  });
  const login = await request(app).post('/api/auth/login').send(DEMO_LOGIN);
  return { app, store, token: login.body.token as string, loginStatus: login.status };
}

describe('API montada para a demonstração', () => {
  it('não cria cliente do Supabase quando recebe os repositórios', async () => {
    await demoApp();
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it('entra com o login de demonstração e lista os dados da loja fictícia', async () => {
    const { app, token, loginStatus } = await demoApp();
    expect(loginStatus).toBe(200);
    const auth = { Authorization: `Bearer ${token}` };

    const clientes = await request(app).get('/api/clientes').set(auth);
    expect(clientes.status).toBe(200);
    expect(clientes.body.length).toBeGreaterThanOrEqual(15);

    const status = await request(app).get('/api/cobrancas/whatsapp-status').set(auth);
    expect(status.body.state).toBe('open');

    const resumo = await request(app).get('/api/resumo/mensal?mes=2026-10').set(auth);
    expect(resumo.status).toBe(200);
    expect(resumo.body.recebido.total).toBeGreaterThan(0);
  });

  it('marcar pago funciona e aparece na lista de pagamentos', async () => {
    const { app, store, token } = await demoApp();
    const auth = { Authorization: `Bearer ${token}` };
    const venda = store.vendas.find((v) => v.ativo && v.status_mes_atual === 'vencido')!;
    const antes = (await request(app).get('/api/vendas/pagamentos').set(auth)).body.length;

    const res = await request(app).patch(`/api/vendas/${venda.id}/pago`).set(auth);

    expect(res.status).toBe(200);
    expect((await request(app).get('/api/vendas/pagamentos').set(auth)).body.length).toBe(antes + 1);
  });

  it('recusa um login que não é o de demonstração', async () => {
    const { app } = await demoApp();
    const res = await request(app).post('/api/auth/login').send({ email: DEMO_LOGIN.email, senha: 'errada123' });
    expect(res.status).toBe(401);
  });
});
