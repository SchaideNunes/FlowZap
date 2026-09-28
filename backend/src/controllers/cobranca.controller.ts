import { Request, Response } from 'express';
import { ReminderService } from '../services/reminder.service.js';
import { EvolutionService } from '../services/evolution.service.js';
import { MessageQueueService } from '../services/message-queue.service.js';

export class CobrancaController {
  private reminderService: ReminderService;
  private evolutionService: EvolutionService;
  private queueService: MessageQueueService;

  constructor(
    reminderService: ReminderService,
    evolutionService: EvolutionService,
    queueService: MessageQueueService
  ) {
    this.reminderService = reminderService;
    this.evolutionService = evolutionService;
    this.queueService = queueService;
  }

  preview = async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.reminderService.previewReminders();
      res.status(200).json(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao pré-visualizar cobranças';
      res.status(500).json({ error: msg });
    }
  };

  disparar = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.reminderService.dispatchReminders();
      res.status(200).json({
        message: 'Disparo de cobranças iniciado com sucesso',
        total: result.dispatchedCount,
        items: result.items,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao disparar cobranças';
      res.status(500).json({ error: msg });
    }
  };

  getQueueStatus = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      waiting: this.queueService.getQueueLength(),
      totalPending: this.queueService.getTotalPending(),
      isBusy: this.queueService.isBusy(),
    });
  };

  getWhatsAppStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
      const status = await this.evolutionService.checkInstanceStatus();
      res.status(200).json(status);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao checar status do WhatsApp';
      res.status(500).json({ error: msg });
    }
  };

  getWhatsAppQrCode = async (_req: Request, res: Response): Promise<void> => {
    try {
      const qrData = await this.evolutionService.getQrCode();
      res.status(200).json(qrData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar QR Code do WhatsApp';
      res.status(500).json({ error: msg });
    }
  };
}
