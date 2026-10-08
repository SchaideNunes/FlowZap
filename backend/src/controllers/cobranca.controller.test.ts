import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { CobrancaController } from './cobranca.controller.js';
import { ReminderService } from '../services/reminder.service.js';
import { IWhatsAppGateway } from '../services/whatsapp-gateway.interface.js';
import { MessageQueueService } from '../services/message-queue.service.js';

describe('CobrancaController (TDD)', () => {
  let mockReminderService: ReminderService;
  let mockGateway: IWhatsAppGateway;
  let mockQueueService: MessageQueueService;
  let controller: CobrancaController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReminderService = {
      previewReminders: vi.fn(),
      dispatchReminders: vi.fn(),
    } as unknown as ReminderService;

    mockGateway = {
      checkInstanceStatus: vi.fn().mockResolvedValue({ state: 'open' }),
      getQrCode: vi.fn(),
    } as unknown as IWhatsAppGateway;

    mockQueueService = {
      getQueueLength: vi.fn().mockReturnValue(0),
      getTotalPending: vi.fn().mockReturnValue(0),
      isBusy: vi.fn().mockReturnValue(false),
    } as unknown as MessageQueueService;

    controller = new CobrancaController(
      mockReminderService,
      mockGateway,
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

  describe('getCentral endpoint', () => {
    it('should return 200 with consolidated notifications data', async () => {
      const mockCentralData = {
        agendadosHoje: [],
        emAtraso: [],
        resumo: {
          totalHoje: 0,
          valorHoje: 0,
          totalAtrasados: 0,
          valorAtrasado: 0,
        },
      };
      (mockReminderService as any).getCentralNotificacoes = vi.fn().mockResolvedValue(mockCentralData);

      await controller.getCentral(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockCentralData);
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

  describe('disparar com WhatsApp desconectado', () => {
    it('responde 409 e não enfileira nada quando o WhatsApp não está conectado', async () => {
      vi.mocked(mockGateway.checkInstanceStatus).mockResolvedValue({ state: 'close' });

      await controller.disparar(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'WhatsApp desconectado. Conecte o WhatsApp antes de disparar as cobranças.',
      });
      expect(mockReminderService.dispatchReminders).not.toHaveBeenCalled();
    });
  });

  describe('ambiente sem WhatsApp (painel hospedado na Vercel)', () => {
    let sedeRepo: { getStatus: ReturnType<typeof vi.fn> };
    let remoteController: CobrancaController;

    beforeEach(() => {
      vi.mocked(mockGateway.checkInstanceStatus).mockResolvedValue({ state: 'close', available: false });
      sedeRepo = { getStatus: vi.fn() };
      remoteController = new CobrancaController(
        mockReminderService,
        mockGateway,
        mockQueueService,
        sedeRepo as any
      );
    });

    it('disparar responde 409 orientando a usar a máquina-sede e não enfileira nada', async () => {
      await remoteController.disparar(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Os disparos só podem ser feitos pela máquina-sede. Abra o sistema no computador da loja.',
      });
      expect(mockReminderService.dispatchReminders).not.toHaveBeenCalled();
    });

    it('status mostra o estado real do WhatsApp da sede quando ela enviou sinal de vida recente', async () => {
      const recent = new Date(Date.now() - 30_000).toISOString();
      sedeRepo.getStatus.mockResolvedValue({ estado_whatsapp: 'open', atualizado_em: recent, ultima_rotina_data: null });

      await remoteController.getWhatsAppStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        state: 'open',
        available: false,
        sede: { online: true, lastSeen: recent },
      });
    });

    it('status mostra a sede offline e WhatsApp desconectado quando o sinal de vida está velho', async () => {
      const old = new Date(Date.now() - 10 * 60_000).toISOString();
      sedeRepo.getStatus.mockResolvedValue({ estado_whatsapp: 'open', atualizado_em: old, ultima_rotina_data: null });

      await remoteController.getWhatsAppStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        state: 'close',
        available: false,
        sede: { online: false, lastSeen: old },
      });
    });

    it('status informa sede desconhecida quando não há registro ou a tabela não existe', async () => {
      sedeRepo.getStatus.mockResolvedValue(null);
      await remoteController.getWhatsAppStatus(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenLastCalledWith({ state: 'close', available: false, sede: null });

      sedeRepo.getStatus.mockRejectedValue(new Error('relation does not exist'));
      await remoteController.getWhatsAppStatus(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenLastCalledWith({ state: 'close', available: false, sede: null });
    });
  });

  describe('whatsapp status and qrcode endpoints', () => {
    it('should return connection state of the WhatsApp connection', async () => {
      vi.mocked(mockGateway.checkInstanceStatus).mockResolvedValue({
        state: 'open',
      });

      await controller.getWhatsAppStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ state: 'open' });
    });

    it('should return qrcode when disconnected', async () => {
      vi.mocked(mockGateway.getQrCode).mockResolvedValue({
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
