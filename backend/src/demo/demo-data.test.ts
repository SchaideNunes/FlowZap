import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { createDemoStore, DEMO_LOGIN } from './demo-data.js';
import { ClienteSchema } from '../schemas/cliente.schema.js';
import { VendaSchema } from '../schemas/venda.schema.js';
import { ContaPagarSchema } from '../schemas/conta-pagar.schema.js';

// 14/10/2026 às 15h no Brasil
const NOW = new Date('2026-10-14T18:00:00Z');

describe('loja de demonstração', () => {
  it('só tem telefones fictícios e clientes válidos pelo esquema', async () => {
    const store = await createDemoStore(NOW);
    expect(store.clientes.length).toBeGreaterThanOrEqual(15);
    for (const c of store.clientes) {
      expect(c.whatsapp).toMatch(/^55119000001\d{2}$/);
      expect(ClienteSchema.safeParse(c).success).toBe(true);
    }
  });

  it('vendas e contas são válidas e as vendas apontam para clientes existentes', async () => {
    const store = await createDemoStore(NOW);
    const ids = new Set(store.clientes.map((c) => c.id));
    for (const v of store.vendas) {
      expect(VendaSchema.safeParse(v).success).toBe(true);
      if (v.cliente_id !== null && v.cliente_id !== undefined) expect(ids.has(v.cliente_id)).toBe(true);
      else expect(v.cliente_avulso).toBeTruthy();
      expect(Number(v.data_vencimento_atual!.slice(8))).toBe(v.dia_vencimento);
    }
    for (const c of store.contas) expect(ContaPagarSchema.safeParse(c).success).toBe(true);
  });

  it('as datas acompanham o dia de hoje: há atrasos, vencimento hoje e vencimentos futuros', async () => {
    const store = await createDemoStore(NOW);
    const vencimentos = store.vendas.filter((v) => v.ativo).map((v) => v.data_vencimento_atual!);
    expect(vencimentos.some((d) => d < '2026-10-14')).toBe(true);
    expect(vencimentos).toContain('2026-10-14');
    expect(vencimentos.some((d) => d > '2026-10-14')).toBe(true);

    const depois = await createDemoStore(new Date('2027-03-02T18:00:00Z'));
    expect(depois.vendas.filter((v) => v.ativo).map((v) => v.data_vencimento_atual)).toContain('2027-03-02');
  });

  it('tem uma venda sem cadastro e pagamentos nos últimos seis meses', async () => {
    const store = await createDemoStore(NOW);
    expect(store.vendas.some((v) => v.cliente_id === null && v.cliente_avulso)).toBe(true);
    const meses = new Set(
      store.historico.filter((h) => h.tipo === 'confirmacao_manual').map((h) => h.data_envio.slice(0, 7))
    );
    for (const m of ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']) expect(meses.has(m)).toBe(true);
  });

  it('nenhum aviso ou pagamento fica no futuro, nem se a demonstração abrir de manhã cedo', async () => {
    // 07h no Brasil: os avisos de hoje ainda não teriam saído às 09h
    for (const now of [NOW, new Date('2026-10-14T10:00:00Z')]) {
      const store = await createDemoStore(now);
      for (const h of store.historico) expect(Date.parse(h.data_envio)).toBeLessThanOrEqual(now.getTime());
    }
  });

  it('o login de demonstração confere com a senha guardada em hash', async () => {
    const store = await createDemoStore(NOW);
    const user = store.usuarios.find((u) => u.email === DEMO_LOGIN.email);
    expect(user).toBeDefined();
    expect(user!.senha_hash).not.toBe(DEMO_LOGIN.senha);
    expect(await bcrypt.compare(DEMO_LOGIN.senha, user!.senha_hash)).toBe(true);
  });
});
