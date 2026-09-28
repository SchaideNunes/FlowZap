import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { CobrancaController } from './cobranca.controller.js';
import { ReminderService } from '../services/reminder.service.js';
import { EvolutionService } from '../services/evolution.service.js';
import { MessageQueueService } from '../services/message-queue.service.js';

describe('CobrancaController (TDD)', () => {
  let mockReminderService: ReminderService;
  let mockEvolutionService: EvolutionService;
  let mockQueueService: MessageQueueService;
  let controller: CobrancaController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReminderService = {
      previewReminders: vi.fn(),
      dispatchReminders: vi.fn(),
    } as unknown as ReminderService;

    mockEvolutionService = {
      checkInstanceStatus: vi.fn(),
      getQrCode: vi.fn(),
    } as unknown as EvolutionService;

    mockQueueService = {
      getQueueLength: vi.fn().mockReturnValue(0),
      getTotalPending: vi.fn().mockReturnValue(0),
      isBusy: vi.fn().mockReturnValue(false),
    } as unknown as MessageQueueService;

    controller = new CobrancaController(
      mockReminderService,
      mockEvolutionService,
      mockQueueService
    );

    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('preview endpoint', () => {
    it('should return 200 with list of reminders to preview', async () => {
      const mockItems = [
        {
          vendaId: 1,
          clienteId: 1,
          clienteNome: 'Maria',
          whatsapp: '5511999999999',
          valor: 150,
          dataVencimento: '15/09/2026',
          tipo: 'lembrete_3d' as const,
          mensagem: 'Lembrete teste',
        },
      ];
      vi.mocked(mockReminderService.previewReminders).mockResolvedValue(mockItems);

      await controller.preview(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockItems);
    });
  });

  describe('disparar endpoint', () => {
    it('should trigger dispatch and return 200 with dispatched count', async () => {
      vi.mocked(mockReminderService.dispatchReminders).mockResolvedValue({
        dispatchedCount: 2,
        items: [],
      });

      await controller.disparar(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Disparo de cobranças iniciado com sucesso',
        total: 2,
        items: [],
      });
    });
  });

  describe('whatsapp status and qrcode endpoints', () => {
    it('should return connection state of Evolution instance', async () => {
      vi.mocked(mockEvolutionService.checkInstanceStatus).mockResolvedValue({
        state: 'open',
      });

      await controller.getWhatsAppStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ state: 'open' });
    });

    it('should return qrcode when disconnected', async () => {
      vi.mocked(mockEvolutionService.getQrCode).mockResolvedValue({
        qrcode: 'data:image/png;base64,mockcode',
        state: 'connecting',
      });

      await controller.getWhatsAppQrCode(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        qrcode: 'data:image/png;base64,mockcode',
        state: 'connecting',
      });
    });
  });
});
