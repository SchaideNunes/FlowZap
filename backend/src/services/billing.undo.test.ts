import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from './billing.service.js';

describe('BillingService: desfazer pagamento', () => {
  let vendaRepo: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; updateStatus: ReturnType<typeof vi.fn> };
  let historicoRepo: {
    findById: ReturnType<typeof vi.fn>;
    findByVendaId: ReturnType<typeof vi.fn>;
    findPagamentos: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let service: BillingService;

  // Venda já no ciclo seguinte, depois de a parcela 2/5 de 10/09 ter sido marcada como paga
  const venda = {
    id: 20,
    cliente_id: 1,
    descricao: 'iPhone 13',
    valor: 150,
    dia_vencimento: 10,
    total_parcelas: 5,
    parcela_atual: 3,
    status_mes_atual: 'pendente' as const,
    data_vencimento_atual: '2026-10-10',
    ativo: true,
  };
  const pagamento = {
    id: 7,
    venda_id: 20,
    tipo: 'confirmacao_manual' as const,
    status_envio: 'enviado' as const,
    data_envio: '2026-09-12T12:00:00.000Z',
    detalhes: { valor: 150, vencimento: '2026-09-10', parcela: 2, total_parcelas: 5, status: 'vencido' },
  };

  beforeEach(() => {
    vendaRepo = {
      findById: vi.fn().mockResolvedValue(venda),
      update: vi.fn().mockImplementation(async (_id, data) => ({ ...venda, ...data })),
      updateStatus: vi.fn(),
    };
    historicoRepo = {
      findById: vi.fn().mockResolvedValue(pagamento),
      findByVendaId: vi.fn().mockResolvedValue([pagamento]),
      findPagamentos: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
    };
    service = new BillingService(vendaRepo as any, {} as any, historicoRepo as any);
  });

  it('markAsPaid guarda o status que a venda tinha, para poder desfazer', async () => {
    vendaRepo.findById.mockResolvedValue({ ...venda, parcela_atual: 2, status_mes_atual: 'vencido', data_vencimento_atual: '2026-09-10' });

    await service.markAsPaid(20);

    expect(historicoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        detalhes: { valor: 150, vencimento: '2026-09-10', parcela: 2, total_parcelas: 5, status: 'vencido' },
      })
    );
  });

  it('volta a venda para a parcela, o vencimento e o status de antes e apaga o registro do pagamento', async () => {
    const result = await service.undoPayment(7);

    expect(vendaRepo.update).toHaveBeenCalledWith(20, {
      data_vencimento_atual: '2026-09-10',
      status_mes_atual: 'vencido',
      parcela_atual: 2,
      ativo: true,
    });
    expect(historicoRepo.delete).toHaveBeenCalledWith(7);
    expect(result.data_vencimento_atual).toBe('2026-09-10');
  });

  it('reativa uma venda que tinha sido quitada pelo pagamento desfeito', async () => {
    vendaRepo.findById.mockResolvedValue({ ...venda, parcela_atual: 5, status_mes_atual: 'pago', ativo: false });
    const ultima = { ...pagamento, detalhes: { ...pagamento.detalhes, parcela: 5, status: 'pendente' } };
    historicoRepo.findById.mockResolvedValue(ultima);
    historicoRepo.findByVendaId.mockResolvedValue([ultima]);

    await service.undoPayment(7);

    expect(vendaRepo.update).toHaveBeenCalledWith(20, expect.objectContaining({ ativo: true, parcela_atual: 5, status_mes_atual: 'pendente' }));
  });

  it('em venda sem parcelas não mexe no número da parcela', async () => {
    const simples = { ...pagamento, detalhes: { valor: 100, vencimento: '2026-09-10', parcela: null, total_parcelas: null, status: 'avisado_1d' } };
    historicoRepo.findById.mockResolvedValue(simples);
    historicoRepo.findByVendaId.mockResolvedValue([simples]);

    await service.undoPayment(7);

    expect(vendaRepo.update).toHaveBeenCalledWith(20, {
      data_vencimento_atual: '2026-09-10',
      status_mes_atual: 'avisado_1d',
      ativo: true,
    });
  });

  it('sem o status gravado, volta como pendente (o histórico impede reenvio de aviso)', async () => {
    const semStatus = { ...pagamento, detalhes: { valor: 150, vencimento: '2026-09-10', parcela: 2, total_parcelas: 5 } };
    historicoRepo.findById.mockResolvedValue(semStatus);
    historicoRepo.findByVendaId.mockResolvedValue([semStatus]);

    await service.undoPayment(7);

    expect(vendaRepo.update).toHaveBeenCalledWith(20, expect.objectContaining({ status_mes_atual: 'pendente' }));
  });

  it('recusa quando o pagamento não existe ou o registro não é um pagamento', async () => {
    historicoRepo.findById.mockResolvedValue(null);
    await expect(service.undoPayment(7)).rejects.toThrow('Pagamento não encontrado');

    historicoRepo.findById.mockResolvedValue({ ...pagamento, tipo: 'vencido' });
    await expect(service.undoPayment(7)).rejects.toThrow('Pagamento não encontrado');

    expect(vendaRepo.update).not.toHaveBeenCalled();
    expect(historicoRepo.delete).not.toHaveBeenCalled();
  });

  it('recusa pagamento antigo, registrado sem os dados da parcela', async () => {
    historicoRepo.findById.mockResolvedValue({ ...pagamento, detalhes: null });

    await expect(service.undoPayment(7)).rejects.toThrow(/não pode ser desfeito/);
    expect(vendaRepo.update).not.toHaveBeenCalled();
  });

  it('só desfaz o pagamento mais recente da venda', async () => {
    const maisNovo = { ...pagamento, id: 9, data_envio: '2026-10-11T12:00:00.000Z' };
    const aviso = { id: 10, venda_id: 20, tipo: 'lembrete_3d', status_envio: 'enviado' };
    historicoRepo.findByVendaId.mockResolvedValue([aviso, maisNovo, pagamento]);

    await expect(service.undoPayment(7)).rejects.toThrow(/mais recente/);
    expect(historicoRepo.delete).not.toHaveBeenCalled();
  });

  it('listPagamentos marca quais pagamentos podem ser desfeitos', async () => {
    const base = { tipo: 'confirmacao_manual', status_envio: 'enviado', venda: { id: 20, valor: 150 } };
    historicoRepo.findPagamentos.mockResolvedValue([
      { ...base, id: 9, venda_id: 20, data_envio: '2026-10-11T12:00:00Z', detalhes: { valor: 150, vencimento: '2026-10-10' } },
      { ...base, id: 7, venda_id: 20, data_envio: '2026-09-12T12:00:00Z', detalhes: { valor: 150, vencimento: '2026-09-10' } },
      { ...base, id: 3, venda_id: 21, data_envio: '2026-09-01T12:00:00Z', detalhes: null },
    ]);

    const result = await service.listPagamentos();

    expect(result.map((p) => [p.id, p.pode_desfazer])).toEqual([
      [9, true], // o mais recente da venda
      [7, false], // já houve pagamento depois dele
      [3, false], // antigo, sem os dados da parcela
    ]);
  });
});
