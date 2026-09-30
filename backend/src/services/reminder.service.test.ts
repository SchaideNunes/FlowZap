import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReminderService } from './reminder.service.js';
import { IVendaRepository } from '../repositories/venda.repository.interface.js';
import { IHistoricoRepository } from '../repositories/historico.repository.interface.js';
import { BillingService } from './billing.service.js';
import { TemplateService } from './template.service.js';
import { MessageQueueService } from './message-queue.service.js';

describe('ReminderService (TDD)', () => {
  let mockVendaRepo: IVendaRepository;
  let mockHistoricoRepo: IHistoricoRepository;
  let mockBillingService: BillingService;
  let mockTemplateService: TemplateService;
  let mockQueueService: MessageQueueService;
  let reminderService: ReminderService;

  const mockActiveVendas = [
    {
      id: 101,
      cliente_id: 1,
      descricao: 'Plano 1',
      valor: 100,
      dia_vencimento: 18,
      status_mes_atual: 'pendente' as const,
      data_vencimento_atual: '2026-09-18',
      ativo: true,
      cliente: {
        id: 1,
        nome: 'Maria Silva',
        whatsapp: '5511999999999',
        ativo: true,
      },
    },
    {
      id: 102,
      cliente_id: 2,
      descricao: 'Plano 2',
      valor: 200,
      dia_vencimento: 16,
      status_mes_atual: 'avisado_3d' as const,
      data_vencimento_atual: '2026-09-16',
      ativo: true,
      cliente: {
        id: 2,
        nome: 'João Santos',
        whatsapp: '5511888888888',
        ativo: true,
      },
    },
  ];

  beforeEach(() => {
    mockVendaRepo = {
      findByClienteId: vi.fn(),
      findById: vi.fn(),
      findActiveVendas: vi.fn().mockResolvedValue(mockActiveVendas),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      getDashboardMetrics: vi.fn(),
    };

    mockHistoricoRepo = {
      findByVendaId: vi.fn(),
      create: vi.fn(),
      hasMessageBeenSentForCycle: vi.fn().mockResolvedValue(false),
    };

    mockBillingService = {
      evaluateReminderState: vi.fn().mockImplementation((venda) => {
        if (venda.id === 101) return { tipo: 'lembrete_3d', novoStatus: 'avisado_3d' };
        if (venda.id === 102) return { tipo: 'lembrete_1d', novoStatus: 'avisado_1d' };
        return null;
      }),
    } as unknown as BillingService;

    mockTemplateService = {
      generateMessage: vi.fn().mockReturnValue('Mensagem mockada formatada'),
    } as unknown as TemplateService;

    mockQueueService = {
      enqueue: vi.fn(),
      getTotalPending: vi.fn().mockReturnValue(0),
      getQueueLength: vi.fn().mockReturnValue(0),
      isBusy: vi.fn().mockReturnValue(false),
    } as unknown as MessageQueueService;

    reminderService = new ReminderService(
      mockVendaRepo,
      mockHistoricoRepo,
      mockBillingService,
      mockTemplateService,
      mockQueueService
    );
  });

  describe('previewReminders', () => {
    it('should identify eligible reminders without sending', async () => {
      const preview = await reminderService.previewReminders('2026-09-15');

      expect(preview).toHaveLength(2);
      expect(preview[0].vendaId).toBe(101);
      expect(preview[0].tipo).toBe('lembrete_3d');
      expect(preview[0].clienteNome).toBe('Maria Silva');
      expect(preview[1].vendaId).toBe(102);
      expect(preview[1].tipo).toBe('lembrete_1d');
      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });

    it('should ignore vendas if already sent in this cycle (duplicate check)', async () => {
      // 101 was already sent
      vi.mocked(mockHistoricoRepo.hasMessageBeenSentForCycle).mockImplementation(
        async (vendaId) => vendaId === 101
      );

      const preview = await reminderService.previewReminders('2026-09-15');

      expect(preview).toHaveLength(1);
      expect(preview[0].vendaId).toBe(102);
    });
  });

  describe('dispatchReminders', () => {
    it('should enqueue eligible reminders and update statuses on dispatch', async () => {
      const result = await reminderService.dispatchReminders('2026-09-15');

      expect(result.dispatchedCount).toBe(2);
      expect(mockQueueService.enqueue).toHaveBeenCalledTimes(2);
    });
  });

  describe('getOverdueReminders', () => {
    it('should return overdue sales with delay calculation and message template', async () => {
      const mockOverdueVendas = [
        ...mockActiveVendas,
        {
          id: 103,
          cliente_id: 3,
          descricao: 'iPhone 13',
          valor: 350,
          dia_vencimento: 5,
          status_mes_atual: 'vencido' as const,
          data_vencimento_atual: '2026-09-05',
          ativo: true,
          cliente: {
            id: 3,
            nome: 'Carlos Souza',
            whatsapp: '5575999999999',
            ativo: true,
          },
        },
      ];
      vi.mocked(mockVendaRepo.findActiveVendas).mockResolvedValue(mockOverdueVendas);
      vi.mocked(mockHistoricoRepo.findByVendaId).mockResolvedValue([
        {
          id: 1,
          venda_id: 103,
          tipo: 'vencido',
          data_envio: '2026-09-06T10:00:00Z',
          status_envio: 'enviado',
          mensagem: 'Aviso de vencido enviado',
        },
      ]);

      const overdue = await reminderService.getOverdueReminders('2026-09-15');

      expect(overdue).toHaveLength(1);
      expect(overdue[0].vendaId).toBe(103);
      expect(overdue[0].clienteNome).toBe('Carlos Souza');
      expect(overdue[0].diasAtraso).toBe(10);
      expect(overdue[0].dataVencimento).toBe('05/09/2026');
      expect(overdue[0].ultimoEnvio?.tipo).toBe('vencido');
    });
  });

  describe('getCentralNotificacoes', () => {
    it('should return consolidated today preview, overdue items, and summary counters', async () => {
      const mockMixedVendas = [
        ...mockActiveVendas,
        {
          id: 103,
          cliente_id: 3,
          descricao: 'Samsung Galaxy',
          valor: 300,
          dia_vencimento: 10,
          status_mes_atual: 'vencido' as const,
          data_vencimento_atual: '2026-09-10',
          ativo: true,
          cliente: {
            id: 3,
            nome: 'Ana Lima',
            whatsapp: '5575888888888',
            ativo: true,
          },
        },
      ];
      vi.mocked(mockVendaRepo.findActiveVendas).mockResolvedValue(mockMixedVendas);

      const central = await reminderService.getCentralNotificacoes('2026-09-15');

      expect(central.agendadosHoje).toHaveLength(2);
      expect(central.emAtraso).toHaveLength(1);
      expect(central.resumo.totalHoje).toBe(2);
      expect(central.resumo.valorHoje).toBe(300); // 100 + 200
      expect(central.resumo.totalAtrasados).toBe(1);
      expect(central.resumo.valorAtrasado).toBe(300);
    });
  });
});
