import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonthlySummaryService, currentMonth } from './monthly-summary.service.js';

describe('MonthlySummaryService (resumo por mês)', () => {
  let historicoRepo: { findPagamentosBetween: ReturnType<typeof vi.fn>; countAvisosBetween: ReturnType<typeof vi.fn> };
  let vendaRepo: { findAllVendas: ReturnType<typeof vi.fn> };
  let clienteRepo: { findAll: ReturnType<typeof vi.fn> };
  let contaRepo: { findAll: ReturnType<typeof vi.fn> };
  let service: MonthlySummaryService;

  const hoje = new Date('2026-10-13T15:00:00.000Z'); // 13/10/2026 12:00 no Brasil
  const cliente = { id: 1, nome: 'Maria', whatsapp: '5511999999999', ativo: true };
  const pagamento = (id: number, quando: string, valor: number | null, vendaValor = 100) => ({
    id,
    venda_id: 10,
    tipo: 'confirmacao_manual',
    status_envio: 'enviado',
    data_envio: quando,
    detalhes: valor === null ? null : { valor, vencimento: '2026-10-10', parcela: 2, total_parcelas: 5 },
    venda: { id: 10, descricao: 'iPhone 13', valor: vendaValor, cliente },
  });

  beforeEach(() => {
    historicoRepo = {
      findPagamentosBetween: vi.fn().mockResolvedValue([
        pagamento(3, '2026-10-12T14:00:00.000Z', 150),
        pagamento(2, '2026-10-01T02:30:00.000Z', 80), // 30/09 23:30 no Brasil: é de setembro
        pagamento(1, '2026-09-10T14:00:00.000Z', null, 70), // antigo, sem valor gravado
      ]),
      countAvisosBetween: vi.fn().mockResolvedValue(7),
    };
    vendaRepo = {
      findAllVendas: vi.fn().mockResolvedValue([
        { id: 10, cliente_id: 1, descricao: 'iPhone 13', valor: 150, valor_total: 750, total_parcelas: 5, status_mes_atual: 'vencido', data_vencimento_atual: '2026-10-10', ativo: true, criado_em: '2026-10-05T14:00:00.000Z', cliente },
        { id: 11, cliente_id: 1, descricao: 'Capinha', valor: 40, total_parcelas: 1, status_mes_atual: 'pendente', data_vencimento_atual: '2026-10-25', ativo: true, criado_em: '2026-08-01T14:00:00.000Z', cliente },
        { id: 12, cliente_id: 1, descricao: 'Fone', valor: 60, status_mes_atual: 'pendente', data_vencimento_atual: '2026-11-05', ativo: true, criado_em: '2026-09-20T14:00:00.000Z', cliente },
        { id: 13, cliente_id: 1, descricao: 'Pausada', valor: 99, status_mes_atual: 'pendente', data_vencimento_atual: '2026-10-20', ativo: false, criado_em: '2026-07-01T14:00:00.000Z', cliente },
      ]),
    };
    clienteRepo = {
      findAll: vi.fn().mockResolvedValue([
        { id: 1, nome: 'Maria', criado_em: '2026-10-02T14:00:00.000Z' },
        { id: 2, nome: 'João', criado_em: '2026-09-02T14:00:00.000Z' },
      ]),
    };
    contaRepo = {
      findAll: vi.fn().mockResolvedValue([
        { id: 1, nome_credor: 'Fornecedor A', valor: 200, data_vencimento: '2026-10-08', pago: true, data_pagamento: '2026-10-07' },
        { id: 2, nome_credor: 'Aluguel', valor: 900, data_vencimento: '2026-10-20', pago: false, data_pagamento: null },
        { id: 3, nome_credor: 'Fornecedor B', valor: 50, data_vencimento: '2026-09-15', pago: true, data_pagamento: '2026-09-15' },
        { id: 4, nome_credor: 'Luz', valor: 120, data_vencimento: '2026-10-05', pago: false, data_pagamento: null },
      ]),
    };
    service = new MonthlySummaryService(historicoRepo as any, vendaRepo as any, clienteRepo as any, contaRepo as any);
  });

  it('o mês atual é calculado no horário do Brasil', () => {
    expect(currentMonth(new Date('2026-11-01T02:00:00.000Z'))).toBe('2026-10'); // 31/10 23:00 no Brasil
    expect(currentMonth(new Date('2026-11-01T03:00:00.000Z'))).toBe('2026-11');
  });

  it('busca os pagamentos dos últimos 6 meses e os avisos só do mês, nos limites do horário do Brasil', async () => {
    await service.getSummary('2026-10', hoje);

    expect(historicoRepo.findPagamentosBetween).toHaveBeenCalledWith('2026-05-01T03:00:00.000Z', '2026-11-01T03:00:00.000Z');
    expect(historicoRepo.countAvisosBetween).toHaveBeenCalledWith('2026-10-01T03:00:00.000Z', '2026-11-01T03:00:00.000Z');
  });

  it('soma o que foi recebido no mês, sem contar pagamento da noite do último dia do mês anterior', async () => {
    const resumo = await service.getSummary('2026-10', hoje);

    expect(resumo.mes).toBe('2026-10');
    expect(resumo.recebido).toEqual({ total: 150, quantidade: 1 });
    expect(resumo.pagamentos).toEqual([
      {
        id: 3,
        data_pagamento: '2026-10-12T14:00:00.000Z',
        cliente_nome: 'Maria',
        descricao: 'iPhone 13',
        valor: 150,
        parcela: 2,
        total_parcelas: 5,
      },
    ]);
  });

  it('usa o valor da venda quando o pagamento é antigo e não tem valor gravado', async () => {
    const resumo = await service.getSummary('2026-09', hoje);

    expect(resumo.recebido).toEqual({ total: 150, quantidade: 2 }); // 80 + 70
  });

  it('mostra o que ainda falta receber com vencimento no mês, separando o que já venceu', async () => {
    const resumo = await service.getSummary('2026-10', hoje);

    // vendas 10 (vencida) e 11 (a vencer); a 12 vence em novembro e a 13 está pausada
    expect(resumo.a_receber).toEqual({ total: 190, quantidade: 2 });
    expect(resumo.vencido).toEqual({ total: 150, quantidade: 1 });
  });

  it('conta vendas e clientes novos do mês', async () => {
    const resumo = await service.getSummary('2026-10', hoje);

    expect(resumo.vendas_novas).toEqual({ quantidade: 1, valor_total: 750 });
    expect(resumo.clientes_novos).toBe(1);
    expect(resumo.vendas[0]).toMatchObject({ id: 10, cliente_nome: 'Maria', descricao: 'iPhone 13', valor_total: 750 });
  });

  it('separa as contas pagas no mês das que vencem no mês e seguem em aberto', async () => {
    const resumo = await service.getSummary('2026-10', hoje);

    expect(resumo.contas_pagas).toEqual({ total: 200, quantidade: 1 });
    expect(resumo.contas_em_aberto).toEqual({ total: 1020, quantidade: 2 });
    expect(resumo.contas.map((c) => c.id).sort()).toEqual([1, 2, 4]);
  });

  it('o saldo do mês é o recebido menos o que foi pago', async () => {
    const resumo = await service.getSummary('2026-10', hoje);

    expect(resumo.saldo).toBe(-50); // 150 - 200
    expect(resumo.avisos_enviados).toBe(7);
  });

  it('traz a evolução dos últimos 6 meses, do mais antigo para o mês escolhido', async () => {
    const resumo = await service.getSummary('2026-10', hoje);

    expect(resumo.historico.map((h) => h.mes)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(resumo.historico[4]).toEqual({ mes: '2026-09', recebido: 150, pago: 50, saldo: 100 });
    expect(resumo.historico[5]).toEqual({ mes: '2026-10', recebido: 150, pago: 200, saldo: -50 });
  });

  it('atravessa a virada do ano ao calcular os meses anteriores', async () => {
    const resumo = await service.getSummary('2027-02', hoje);

    expect(resumo.historico.map((h) => h.mes)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
    expect(historicoRepo.findPagamentosBetween).toHaveBeenCalledWith('2026-09-01T03:00:00.000Z', '2027-03-01T03:00:00.000Z');
  });

  it('em um mês sem movimento tudo vem zerado', async () => {
    const resumo = await service.getSummary('2026-06', hoje);

    expect(resumo.recebido).toEqual({ total: 0, quantidade: 0 });
    expect(resumo.contas_pagas).toEqual({ total: 0, quantidade: 0 });
    expect(resumo.saldo).toBe(0);
    expect(resumo.pagamentos).toEqual([]);
  });
});
