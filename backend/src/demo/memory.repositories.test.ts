import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryRepositories, createEmptyStore, MemoryStore } from './memory.repositories.js';
import { AppRepositories } from '../create-app.js';

const iso = (s: string) => new Date(s).toISOString();

describe('repositórios em memória (modo demonstração)', () => {
  let store: MemoryStore;
  let repos: AppRepositories;

  beforeEach(() => {
    store = createEmptyStore();
    store.clientes.push(
      { id: 1, nome: 'Bruno', whatsapp: '5511900000101', ativo: true, observacoes: null, criado_em: iso('2026-01-10T12:00:00Z') },
      { id: 2, nome: 'Ana', whatsapp: '5511900000102', ativo: true, observacoes: null, criado_em: iso('2026-02-10T12:00:00Z') },
      { id: 3, nome: 'Carla', whatsapp: '5511900000103', ativo: false, observacoes: null, criado_em: iso('2026-03-10T12:00:00Z') }
    );
    const base = { dia_vencimento: 10, valor_total: null, taxa_juros: null, total_parcelas: null, parcela_atual: 1, observacoes: null, criado_em: iso('2026-01-10T12:00:00Z') };
    store.vendas.push(
      { ...base, id: 1, cliente_id: 1, cliente_avulso: null, descricao: 'Celular', valor: 100, status_mes_atual: 'vencido', data_vencimento_atual: '2026-10-20', ativo: true },
      { ...base, id: 2, cliente_id: 1, cliente_avulso: null, descricao: 'Fone', valor: 50, status_mes_atual: 'pendente', data_vencimento_atual: '2026-10-05', ativo: false },
      { ...base, id: 3, cliente_id: 3, cliente_avulso: null, descricao: 'Capa', valor: 30, status_mes_atual: 'avisado_1d', data_vencimento_atual: '2026-10-12', ativo: true },
      { ...base, id: 4, cliente_id: null, cliente_avulso: 'Sem Cadastro', descricao: 'Cabo', valor: 20, status_mes_atual: 'pago', data_vencimento_atual: '2026-10-01', ativo: true }
    );
    repos = createMemoryRepositories(store);
  });

  describe('clientes', () => {
    it('lista em ordem de nome, com a contagem de vendas ativas', async () => {
      const lista = await repos.cliente.findAll();
      expect(lista.map((c) => c.nome)).toEqual(['Ana', 'Bruno', 'Carla']);
      expect(lista.find((c) => c.id === 1)?.vendas_ativas_count).toBe(1);
      expect(lista.find((c) => c.id === 1)?.criado_em).toBe(iso('2026-01-10T12:00:00Z'));
    });

    it('filtra pela busca sem diferenciar maiúsculas', async () => {
      const lista = await repos.cliente.findAll('bru');
      expect(lista.map((c) => c.nome)).toEqual(['Bruno']);
    });

    it('cria com id novo e devolve uma cópia, não o objeto guardado', async () => {
      const novo = await repos.cliente.create({ nome: 'Diego', whatsapp: '5511900000104', ativo: true });
      expect(novo.id).toBe(4);
      novo.nome = 'Alterado fora';
      expect((await repos.cliente.findById(4))?.nome).toBe('Diego');
    });
  });

  describe('vendas', () => {
    it('vendas ativas: só de cliente ativo e com cadastro, em ordem de vencimento, com o cliente junto', async () => {
      const ativas = await repos.venda.findActiveVendas();
      expect(ativas.map((v) => v.id)).toEqual([1]);
      expect(ativas[0].cliente).toEqual({ id: 1, nome: 'Bruno', whatsapp: '5511900000101', ativo: true });
    });

    it('todas as vendas incluem a venda sem cadastro (cliente nulo), em ordem de vencimento', async () => {
      const todas = await repos.venda.findAllVendas();
      expect(todas.map((v) => v.id)).toEqual([4, 2, 3, 1]);
      expect(todas[0].cliente).toBeNull();
    });

    it('updateStatus troca o status e, quando informado, o vencimento', async () => {
      await repos.venda.updateStatus(1, 'pago', '2026-11-20');
      const v = await repos.venda.findById(1);
      expect(v?.status_mes_atual).toBe('pago');
      expect(v?.data_vencimento_atual).toBe('2026-11-20');
    });

    it('métricas do painel consideram só as vendas ativas', async () => {
      const m = await repos.venda.getDashboardMetrics();
      expect(m).toEqual({
        totalPendentes: 0,
        totalAvisados: 1,
        totalVencidos: 1,
        totalPagos: 1,
        valorTotalMensal: 150,
        valorTotalRecebido: 20,
      });
    });
  });

  describe('histórico', () => {
    beforeEach(() => {
      store.historico.push(
        { id: 1, venda_id: 1, tipo: 'lembrete_3d', status_envio: 'enviado', data_envio: iso('2026-10-17T12:00:00Z'), mensagem: null, detalhes: null },
        { id: 2, venda_id: 1, tipo: 'confirmacao_manual', status_envio: 'enviado', data_envio: iso('2026-09-20T15:00:00Z'), mensagem: null, detalhes: { valor: 100 } },
        { id: 3, venda_id: 1, tipo: 'vencido', status_envio: 'falha', data_envio: iso('2026-10-20T12:00:00Z'), mensagem: null, detalhes: null },
        { id: 4, venda_id: 1, tipo: 'lembrete_1d', status_envio: 'enviado', data_envio: iso('2026-08-19T12:00:00Z'), mensagem: null, detalhes: null }
      );
    });

    it('um aviso conta para o ciclo só se foi enviado nos 20 dias antes do vencimento', async () => {
      expect(await repos.historico.hasMessageBeenSentForCycle(1, 'lembrete_3d', '2026-10-20')).toBe(true);
      expect(await repos.historico.hasMessageBeenSentForCycle(1, 'lembrete_1d', '2026-10-20')).toBe(false);
      expect(await repos.historico.hasMessageBeenSentForCycle(1, 'vencido', '2026-10-20')).toBe(false);
    });

    it('enviados recentes: só os enviados, do mais novo ao mais antigo, com a venda e o cliente', async () => {
      const lista = await repos.historico.findRecentEnviados();
      expect(lista.map((h) => h.id)).toEqual([1, 2, 4]);
      expect(lista[0].venda?.cliente?.nome).toBe('Bruno');
    });

    it('pagamentos num intervalo e contagem de avisos (sem contar pagamentos)', async () => {
      const pagos = await repos.historico.findPagamentosBetween(iso('2026-09-01T03:00:00Z'), iso('2026-10-01T03:00:00Z'));
      expect(pagos.map((h) => h.id)).toEqual([2]);
      expect(await repos.historico.countAvisosBetween(iso('2026-08-01T00:00:00Z'), iso('2026-11-01T00:00:00Z'))).toBe(2);
    });

    it('create preenche id e data de envio', async () => {
      const h = await repos.historico.create({ venda_id: 1, tipo: 'lembrete_2d', status_envio: 'enviado' });
      expect(h.id).toBe(5);
      expect(typeof h.data_envio).toBe('string');
    });
  });

  it('contas: total pendente soma só as não pagas', async () => {
    store.contas.push(
      { id: 1, nome_credor: 'Aluguel', valor: 1000, pago: true, data_vencimento: '2026-10-05', data_pagamento: '2026-10-05' },
      { id: 2, nome_credor: 'Energia', valor: 200.5, pago: false, data_vencimento: '2026-10-15', data_pagamento: null }
    );
    expect(await repos.contaPagar.getTotalPendente()).toBe(200.5);
  });

  it('trava de sede: livre ou do mesmo dono aceita; de outro só com force', async () => {
    expect(await repos.sedeStatus.claimSede('a', 'Loja', false)).toBe(true);
    expect(await repos.sedeStatus.claimSede('a', 'Loja', false)).toBe(true);
    expect(await repos.sedeStatus.claimSede('b', 'Casa', false)).toBe(false);
    expect(await repos.sedeStatus.claimSede('b', 'Casa', true)).toBe(true);
    expect((await repos.sedeStatus.getStatus())?.sede_nome).toBe('Casa');
  });

  it('backup exporta cópias das tabelas', async () => {
    const linhas = await repos.backup.exportTable('clientes');
    expect(linhas).toHaveLength(3);
    (linhas[0] as { nome: string }).nome = 'Alterado fora';
    expect(store.clientes[0].nome).toBe('Bruno');
  });
});
