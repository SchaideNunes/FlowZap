import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from './billing.service.js';
import { IVendaRepository, VendaWithCliente } from '../repositories/venda.repository.interface.js';
import { IClienteRepository } from '../repositories/cliente.repository.interface.js';
import { IHistoricoRepository } from '../repositories/historico.repository.interface.js';

describe('BillingService (TDD)', () => {
  let mockVendaRepo: IVendaRepository;
  let mockClienteRepo: IClienteRepository;
  let mockHistoricoRepo: IHistoricoRepository;
  let billingService: BillingService;

  beforeEach(() => {
    mockVendaRepo = {
      findByClienteId: vi.fn(),
      findById: vi.fn(),
      findActiveVendas: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      getDashboardMetrics: vi.fn(),
    };

    mockClienteRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockHistoricoRepo = {
      findByVendaId: vi.fn(),
      create: vi.fn(),
      hasMessageBeenSentForCycle: vi.fn(),
    };

    billingService = new BillingService(mockVendaRepo, mockClienteRepo, mockHistoricoRepo);
  });

  describe('createVenda', () => {
    it('should calculate initial due date automatically when creating a venda', async () => {
      vi.mocked(mockClienteRepo.findById).mockResolvedValue({
        id: 1,
        nome: 'João Silva',
        whatsapp: '5511999999999',
        ativo: true,
      });

      vi.mocked(mockVendaRepo.create).mockImplementation(async (data) => ({
        id: 10,
        cliente_id: data.cliente_id,
        descricao: data.descricao,
        valor: data.valor,
        dia_vencimento: data.dia_vencimento,
        status_mes_atual: 'pendente',
        data_vencimento_atual: data.data_vencimento_atual!,
        ativo: true,
      }));

      const result = await billingService.createVenda({
        cliente_id: 1,
        descricao: 'Plano Pro Mensal',
        valor: 150.0,
        dia_vencimento: 10,
      });

      expect(mockVendaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cliente_id: 1,
          descricao: 'Plano Pro Mensal',
          valor: 150.0,
          dia_vencimento: 10,
          data_vencimento_atual: expect.stringMatching(/^\d{4}-\d{2}-10$/),
        })
      );
      expect(result.id).toBe(10);
    });

    it('should throw error if cliente does not exist', async () => {
      vi.mocked(mockClienteRepo.findById).mockResolvedValue(null);

      await expect(
        billingService.createVenda({
          cliente_id: 999,
          descricao: 'Plano Inválido',
          valor: 50.0,
          dia_vencimento: 5,
        })
      ).rejects.toThrow('Cliente não encontrado');
    });
  });

  describe('markAsPaid (Manual Payment Confirmation)', () => {
    it('should advance due date by 1 month, reset status to pendente, and log to historico', async () => {
      const existingVenda: VendaWithCliente = {
        id: 10,
        cliente_id: 1,
        descricao: 'Internet 500MB',
        valor: 120.0,
        dia_vencimento: 15,
        status_mes_atual: 'vencido',
        data_vencimento_atual: '2026-09-15',
        ativo: true,
      };

      vi.mocked(mockVendaRepo.findById).mockResolvedValue(existingVenda);
      vi.mocked(mockVendaRepo.updateStatus).mockImplementation(async (id, status, nextDue) => ({
        ...existingVenda,
        status_mes_atual: status,
        data_vencimento_atual: nextDue || existingVenda.data_vencimento_atual,
      }));

      const updated = await billingService.markAsPaid(10);

      // Verify status was reset to pendente
      expect(mockVendaRepo.updateStatus).toHaveBeenCalledWith(10, 'pendente', '2026-10-15');

      // Verify message logged to historico_mensagens
      expect(mockHistoricoRepo.create).toHaveBeenCalledWith({
        venda_id: 10,
        tipo: 'confirmacao_manual',
        status_envio: 'enviado',
        mensagem: 'Pagamento confirmado manualmente pelo usuário',
        detalhes: { valor: 120.0, vencimento: '2026-09-15', parcela: null, total_parcelas: null },
      });

      expect(updated.status_mes_atual).toBe('pendente');
      expect(updated.data_vencimento_atual).toBe('2026-10-15');
    });

    it('should throw error if venda does not exist', async () => {
      vi.mocked(mockVendaRepo.findById).mockResolvedValue(null);

      await expect(billingService.markAsPaid(999)).rejects.toThrow('Venda não encontrada');
    });

    it('should increment parcela_atual and advance month when paying an intermediate installment', async () => {
      const vendaParcelada: VendaWithCliente = {
        id: 20,
        cliente_id: 1,
        descricao: 'iPhone 13',
        valor: 150.0,
        dia_vencimento: 10,
        total_parcelas: 5,
        parcela_atual: 2,
        status_mes_atual: 'vencido',
        data_vencimento_atual: '2026-09-10',
        ativo: true,
      };

      vi.mocked(mockVendaRepo.findById).mockResolvedValue(vendaParcelada);
      vi.mocked(mockVendaRepo.update).mockResolvedValue({
        ...vendaParcelada,
        parcela_atual: 3,
        status_mes_atual: 'pendente',
        data_vencimento_atual: '2026-10-10',
      });

      const updated = await billingService.markAsPaid(20);

      expect(mockVendaRepo.update).toHaveBeenCalledWith(20, expect.objectContaining({
        status_mes_atual: 'pendente',
        parcela_atual: 3,
      }));
      expect(updated.parcela_atual).toBe(3);
      expect(mockHistoricoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          detalhes: { valor: 150.0, vencimento: '2026-09-10', parcela: 2, total_parcelas: 5 },
        })
      );
    });
  });

  describe('listPagamentos (pagamentos recebidos)', () => {
    it('devolve o valor e o vencimento gravados no momento do pagamento', async () => {
      mockHistoricoRepo.findPagamentos = vi.fn().mockResolvedValue([
        {
          id: 7,
          venda_id: 10,
          tipo: 'confirmacao_manual',
          status_envio: 'enviado',
          data_envio: '2026-10-08T22:10:00.000Z',
          detalhes: { valor: 120, vencimento: '2026-09-15', parcela: 2, total_parcelas: 5 },
          venda: {
            id: 10,
            descricao: 'iPhone 13',
            valor: 999,
            status_mes_atual: 'pendente',
            data_vencimento_atual: '2026-10-15',
            cliente: { id: 1, nome: 'João Silva', whatsapp: '5511999999999' },
          },
        },
      ]);

      const result = await billingService.listPagamentos(50);

      expect(mockHistoricoRepo.findPagamentos).toHaveBeenCalledWith(50);
      expect(result).toEqual([
        {
          id: 7,
          venda_id: 10,
          data_pagamento: '2026-10-08T22:10:00.000Z',
          valor: 120,
          vencimento: '2026-09-15',
          parcela: 2,
          total_parcelas: 5,
          descricao: 'iPhone 13',
          cliente_nome: 'João Silva',
        },
      ]);
    });

    it('usa o valor atual da venda nos pagamentos antigos, sem detalhes gravados', async () => {
      mockHistoricoRepo.findPagamentos = vi.fn().mockResolvedValue([
        {
          id: 3,
          venda_id: 11,
          tipo: 'confirmacao_manual',
          status_envio: 'enviado',
          data_envio: '2026-10-01T12:00:00.000Z',
          detalhes: null,
          venda: {
            id: 11,
            descricao: 'Capinha',
            valor: 80,
            status_mes_atual: 'pendente',
            data_vencimento_atual: '2026-11-05',
          },
        },
      ]);

      const [pagamento] = await billingService.listPagamentos();

      expect(pagamento.valor).toBe(80);
      expect(pagamento.vencimento).toBeNull();
      expect(pagamento.parcela).toBeNull();
      expect(pagamento.cliente_nome).toBeNull();
    });
  });

  describe('markAsPaid (última parcela)', () => {

    it('should complete sale (ativo: false) when paying the final installment', async () => {
      const ultimaParcelaVenda: VendaWithCliente = {
        id: 21,
        cliente_id: 1,
        descricao: 'iPhone 13',
        valor: 150.0,
        dia_vencimento: 10,
        total_parcelas: 5,
        parcela_atual: 5,
        status_mes_atual: 'pendente',
        data_vencimento_atual: '2026-09-10',
        ativo: true,
      };

      vi.mocked(mockVendaRepo.findById).mockResolvedValue(ultimaParcelaVenda);
      vi.mocked(mockVendaRepo.update).mockResolvedValue({
        ...ultimaParcelaVenda,
        status_mes_atual: 'pago',
        ativo: false,
      });

      const updated = await billingService.markAsPaid(21);

      expect(mockVendaRepo.update).toHaveBeenCalledWith(21, expect.objectContaining({
        status_mes_atual: 'pago',
        ativo: false,
        parcela_atual: 5,
      }));
      expect(updated.ativo).toBe(false);
    });
  });

  describe('evaluateReminderState', () => {
    it('should recommend lembrete_3d when exactly 3 days before due date and status is pendente', () => {
      const venda: VendaWithCliente = {
        id: 1,
        cliente_id: 1,
        descricao: 'Plano',
        valor: 100,
        dia_vencimento: 18,
        status_mes_atual: 'pendente',
        data_vencimento_atual: '2026-09-18',
        ativo: true,
      };

      const action = billingService.evaluateReminderState(venda, '2026-09-15');
      expect(action).toEqual({
        tipo: 'lembrete_3d',
        novoStatus: 'avisado_3d',
      });
    });

    it('should recommend lembrete_1d when 1 day before due date and status is not avisado_1d', () => {
      const venda: VendaWithCliente = {
        id: 1,
        cliente_id: 1,
        descricao: 'Plano',
        valor: 100,
        dia_vencimento: 16,
        status_mes_atual: 'avisado_3d',
        data_vencimento_atual: '2026-09-16',
        ativo: true,
      };

      const action = billingService.evaluateReminderState(venda, '2026-09-15');
      expect(action).toEqual({
        tipo: 'lembrete_1d',
        novoStatus: 'avisado_1d',
      });
    });

    it('should recommend vencido on or after due date if not paid and not already marked vencido', () => {
      const venda: VendaWithCliente = {
        id: 1,
        cliente_id: 1,
        descricao: 'Plano',
        valor: 100,
        dia_vencimento: 15,
        status_mes_atual: 'avisado_1d',
        data_vencimento_atual: '2026-09-15',
        ativo: true,
      };

      const action = billingService.evaluateReminderState(venda, '2026-09-15');
      expect(action).toEqual({
        tipo: 'vencido',
        novoStatus: 'vencido',
      });
    });

    describe('janela de 3 dias: um aviso por dia até o vencimento', () => {
      const makeVenda = (status: VendaWithCliente['status_mes_atual'], due: string): VendaWithCliente => ({
        id: 1,
        cliente_id: 1,
        descricao: 'Plano',
        valor: 100,
        dia_vencimento: 18,
        status_mes_atual: status,
        data_vencimento_atual: due,
        ativo: true,
      });

      it('avisa 2 dias antes (lembrete_2d) quando ainda só foi avisado há 3 dias', () => {
        const action = billingService.evaluateReminderState(makeVenda('avisado_3d', '2026-09-17'), '2026-09-15');
        expect(action).toEqual({ tipo: 'lembrete_2d', novoStatus: 'avisado_3d' });
      });

      it('avisa 2 dias antes também quando a venda entrou na janela agora (status pendente)', () => {
        const action = billingService.evaluateReminderState(makeVenda('pendente', '2026-09-17'), '2026-09-15');
        expect(action).toEqual({ tipo: 'lembrete_2d', novoStatus: 'avisado_3d' });
      });

      it('não avisa 2 dias antes se o aviso de 1 dia já foi enviado ou já venceu', () => {
        expect(billingService.evaluateReminderState(makeVenda('avisado_1d', '2026-09-17'), '2026-09-15')).toBeNull();
        expect(billingService.evaluateReminderState(makeVenda('vencido', '2026-09-17'), '2026-09-15')).toBeNull();
      });

      it('não repete o aviso de 3 dias quando ele já foi enviado', () => {
        expect(billingService.evaluateReminderState(makeVenda('avisado_3d', '2026-09-18'), '2026-09-15')).toBeNull();
      });

      it('avisa 1 dia antes mesmo que a venda tenha entrado na janela só agora (status pendente)', () => {
        const action = billingService.evaluateReminderState(makeVenda('pendente', '2026-09-16'), '2026-09-15');
        expect(action).toEqual({ tipo: 'lembrete_1d', novoStatus: 'avisado_1d' });
      });

      it('não avisa nada fora da janela (mais de 3 dias para vencer)', () => {
        expect(billingService.evaluateReminderState(makeVenda('pendente', '2026-09-19'), '2026-09-15')).toBeNull();
        expect(billingService.evaluateReminderState(makeVenda('pendente', '2026-10-15'), '2026-09-15')).toBeNull();
      });
    });

    it('should return null if venda is already marked pago', () => {
      const venda: VendaWithCliente = {
        id: 1,
        cliente_id: 1,
        descricao: 'Plano',
        valor: 100,
        dia_vencimento: 15,
        status_mes_atual: 'pago',
        data_vencimento_atual: '2026-09-15',
        ativo: true,
      };

      const action = billingService.evaluateReminderState(venda, '2026-09-15');
      expect(action).toBeNull();
    });

    it('should return null if venda is inactive', () => {
      const venda: VendaWithCliente = {
        id: 1,
        cliente_id: 1,
        descricao: 'Plano',
        valor: 100,
        dia_vencimento: 15,
        status_mes_atual: 'pendente',
        data_vencimento_atual: '2026-09-15',
        ativo: false,
      };

      const action = billingService.evaluateReminderState(venda, '2026-09-15');
      expect(action).toBeNull();
    });
  });
});
