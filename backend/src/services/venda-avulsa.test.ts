import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateVendaSchema, UpdateVendaSchema } from '../schemas/venda.schema.js';
import { BillingService } from './billing.service.js';
import { MonthlySummaryService } from './monthly-summary.service.js';
import { SupabaseVendaRepository } from '../repositories/supabase-venda.repository.js';

describe('Venda para cliente sem cadastro', () => {
  const base = { descricao: 'Película', valor: 50, dia_vencimento: 10 };

  describe('validação', () => {
    it('aceita venda só com o nome do cliente, sem cadastro', () => {
      const result = CreateVendaSchema.safeParse({ ...base, cliente_avulso: '  João da Esquina  ' });

      expect(result.success).toBe(true);
      expect(result.success && result.data.cliente_avulso).toBe('João da Esquina');
    });

    it('continua aceitando venda para cliente cadastrado', () => {
      expect(CreateVendaSchema.safeParse({ ...base, cliente_id: 1 }).success).toBe(true);
    });

    it('recusa venda sem cliente nenhum, ou com os dois ao mesmo tempo', () => {
      expect(CreateVendaSchema.safeParse(base).success).toBe(false);
      expect(CreateVendaSchema.safeParse({ ...base, cliente_id: 1, cliente_avulso: 'João' }).success).toBe(false);
    });

    it('recusa nome curto demais', () => {
      expect(CreateVendaSchema.safeParse({ ...base, cliente_avulso: 'J' }).success).toBe(false);
    });

    it('permite vincular depois a venda a um cliente cadastrado', () => {
      const result = UpdateVendaSchema.safeParse({ cliente_id: 7, cliente_avulso: null });

      expect(result.success).toBe(true);
      expect(result.success && result.data).toEqual({ cliente_id: 7, cliente_avulso: null });
    });
  });

  describe('BillingService', () => {
    let vendaRepo: { create: ReturnType<typeof vi.fn> };
    let clienteRepo: { findById: ReturnType<typeof vi.fn> };
    let historicoRepo: { findPagamentos: ReturnType<typeof vi.fn> };
    let service: BillingService;

    beforeEach(() => {
      vendaRepo = { create: vi.fn().mockImplementation(async (data) => ({ id: 30, ...data })) };
      clienteRepo = { findById: vi.fn().mockResolvedValue(null) };
      historicoRepo = { findPagamentos: vi.fn() };
      service = new BillingService(vendaRepo as any, clienteRepo as any, historicoRepo as any);
    });

    it('cria a venda sem procurar cliente quando ela é sem cadastro', async () => {
      const venda = await service.createVenda({ ...base, cliente_avulso: 'João da Esquina', ativo: true });

      expect(clienteRepo.findById).not.toHaveBeenCalled();
      expect(vendaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cliente_avulso: 'João da Esquina', data_vencimento_atual: expect.any(String) })
      );
      expect(venda.id).toBe(30);
    });

    it('com cliente_id, continua exigindo que o cliente exista', async () => {
      await expect(service.createVenda({ ...base, cliente_id: 99, ativo: true })).rejects.toThrow('Cliente não encontrado');
    });

    it('mostra o nome do cliente sem cadastro na lista de pagamentos', async () => {
      historicoRepo.findPagamentos.mockResolvedValue([
        {
          id: 1,
          venda_id: 30,
          tipo: 'confirmacao_manual',
          status_envio: 'enviado',
          data_envio: '2026-10-12T14:00:00.000Z',
          detalhes: { valor: 50, vencimento: '2026-10-10' },
          venda: { id: 30, descricao: 'Película', valor: 50, cliente: null, cliente_avulso: 'João da Esquina' },
        },
      ]);

      const [pagamento] = await service.listPagamentos();

      expect(pagamento.cliente_nome).toBe('João da Esquina');
    });
  });

  it('o resumo mensal mostra o nome do cliente sem cadastro', async () => {
    const venda = {
      id: 30,
      descricao: 'Película',
      valor: 50,
      status_mes_atual: 'pendente',
      data_vencimento_atual: '2026-10-10',
      ativo: true,
      criado_em: '2026-10-05T14:00:00.000Z',
      cliente: null,
      cliente_avulso: 'João da Esquina',
    };
    const service = new MonthlySummaryService(
      {
        findPagamentosBetween: vi.fn().mockResolvedValue([
          { id: 1, venda_id: 30, data_envio: '2026-10-12T14:00:00.000Z', detalhes: { valor: 50 }, venda },
        ]),
        countAvisosBetween: vi.fn().mockResolvedValue(0),
      } as any,
      { findAllVendas: vi.fn().mockResolvedValue([venda]) } as any,
      { findAll: vi.fn().mockResolvedValue([]) } as any,
      { findAll: vi.fn().mockResolvedValue([]) } as any
    );

    const resumo = await service.getSummary('2026-10', new Date('2026-10-13T15:00:00.000Z'));

    expect(resumo.pagamentos[0].cliente_nome).toBe('João da Esquina');
    expect(resumo.vendas[0].cliente_nome).toBe('João da Esquina');
  });

  describe('SupabaseVendaRepository.create', () => {
    const build = () => {
      const insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }) }),
      });
      const repo = new SupabaseVendaRepository({ from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient);
      return { repo, insert };
    };

    it('grava o nome e deixa o cliente vazio na venda sem cadastro', async () => {
      const { repo, insert } = build();

      await repo.create({ ...base, cliente_avulso: 'João da Esquina', data_vencimento_atual: '2026-10-10', ativo: true });

      expect(insert.mock.calls[0][0]).toMatchObject({ cliente_id: null, cliente_avulso: 'João da Esquina' });
    });

    it('não envia a coluna nova nas vendas comuns (banco ainda sem a migração continua funcionando)', async () => {
      const { repo, insert } = build();

      await repo.create({ ...base, cliente_id: 1, data_vencimento_atual: '2026-10-10', ativo: true });

      expect(insert.mock.calls[0][0]).not.toHaveProperty('cliente_avulso');
      expect(insert.mock.calls[0][0].cliente_id).toBe(1);
    });
  });
});
