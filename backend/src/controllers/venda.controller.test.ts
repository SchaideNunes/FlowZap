import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { VendaController } from './venda.controller.js';
import { IVendaRepository } from '../repositories/venda.repository.interface.js';
import { IHistoricoRepository } from '../repositories/historico.repository.interface.js';
import { BillingService } from '../services/billing.service.js';

describe('VendaController (TDD)', () => {
  let mockVendaRepo: IVendaRepository;
  let mockHistoricoRepo: IHistoricoRepository;
  let mockBillingService: BillingService;
  let controller: VendaController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockVendaRepo = {
      findByClienteId: vi.fn(),
      findById: vi.fn(),
      findActiveVendas: vi.fn(),
      findAllVendas: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      getDashboardMetrics: vi.fn(),
    };
    mockHistoricoRepo = {
      findByVendaId: vi.fn(),
      create: vi.fn(),
      hasMessageBeenSentForCycle: vi.fn(),
    };
    mockBillingService = {
      createVenda: vi.fn(),
      markAsPaid: vi.fn(),
      listPagamentos: vi.fn(),
      evaluateReminderState: vi.fn(),
    } as unknown as BillingService;

    controller = new VendaController(mockVendaRepo, mockHistoricoRepo, mockBillingService);

    mockReq = {
      params: {},
      query: {},
      body: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('getAll endpoint', () => {
    it('should return 200 with all vendas and their clientes', async () => {
      const mockList = [
        {
          id: 1,
          cliente_id: 1,
          descricao: 'Samsung A57',
          valor: 200,
          dia_vencimento: 5,
          status_mes_atual: 'pendente' as const,
          data_vencimento_atual: '2026-10-05',
          ativo: true,
          cliente: { id: 1, nome: 'Schaide', whatsapp: '5511912345678', ativo: true },
        },
      ];
      vi.mocked(mockVendaRepo.findAllVendas).mockResolvedValue(mockList);

      await controller.getAll(mockReq as Request, mockRes as Response);

      expect(mockVendaRepo.findAllVendas).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockList);
    });
  });

  describe('markAsPaid endpoint', () => {
    it('should call billingService.markAsPaid and return 200 with updated venda', async () => {
      mockReq.params = { id: '10' };
      const updatedVenda = {
        id: 10,
        cliente_id: 1,
        descricao: 'Plano',
        valor: 100,
        dia_vencimento: 10,
        status_mes_atual: 'pendente' as const,
        data_vencimento_atual: '2026-10-10',
        ativo: true,
      };
      vi.mocked(mockBillingService.markAsPaid).mockResolvedValue(updatedVenda);

      await controller.markAsPaid(mockReq as Request, mockRes as Response);

      expect(mockBillingService.markAsPaid).toHaveBeenCalledWith(10);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          venda: updatedVenda,
        })
      );
    });

    it('should return 400 if id is not a number', async () => {
      mockReq.params = { id: 'abc' };

      await controller.markAsPaid(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'ID inválido' });
    });
  });

  describe('getPagamentos endpoint', () => {
    it('should return 200 with the received payments', async () => {
      const pagamentos = [
        {
          id: 7,
          venda_id: 10,
          data_pagamento: '2026-10-08T22:10:00.000Z',
          valor: 120,
          vencimento: '2026-09-15',
          parcela: null,
          total_parcelas: null,
          descricao: 'Internet 500MB',
          cliente_nome: 'João Silva',
        },
      ];
      vi.mocked(mockBillingService.listPagamentos).mockResolvedValue(pagamentos);

      await controller.getPagamentos(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(pagamentos);
    });

    it('should return 500 when the lookup fails', async () => {
      vi.mocked(mockBillingService.listPagamentos).mockRejectedValue(new Error('falhou'));

      await controller.getPagamentos(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'falhou' });
    });
  });

  describe('getMetrics endpoint', () => {
    it('should return dashboard metrics from repository', async () => {
      const mockMetrics = {
        totalPendentes: 3,
        totalAvisados: 2,
        totalVencidos: 1,
        totalPagos: 4,
        valorTotalMensal: 1500,
        valorTotalRecebido: 600,
      };
      vi.mocked(mockVendaRepo.getDashboardMetrics).mockResolvedValue(mockMetrics);

      await controller.getMetrics(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockMetrics);
    });
  });
});
