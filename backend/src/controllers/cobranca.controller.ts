import { Request, Response } from 'express';
import { ReminderService } from '../services/reminder.service.js';
import { IWhatsAppGateway, ConnectionStatus } from '../services/whatsapp-gateway.interface.js';
import { MessageQueueService } from '../services/message-queue.service.js';
import { ISedeStatusRepository } from '../repositories/sede-status.repository.interface.js';

// Sinal de vida da sede mais antigo que isto significa computador desligado ou sem internet
const SEDE_ONLINE_WINDOW_MS = 3 * 60 * 1000;

export class CobrancaController {
  private reminderService: ReminderService;
  private whatsAppGateway: IWhatsAppGateway;
  private queueService: MessageQueueService;
  private sedeStatusRepo?: ISedeStatusRepository;

  constructor(
    reminderService: ReminderService,
    whatsAppGateway: IWhatsAppGateway,
    queueService: MessageQueueService,
    sedeStatusRepo?: ISedeStatusRepository
  ) {
    this.reminderService = reminderService;
    this.whatsAppGateway = whatsAppGateway;
    this.queueService = queueService;
    this.sedeStatusRepo = sedeStatusRepo;
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

  getCentral = async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.reminderService.getCentralNotificacoes();
      res.status(200).json(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar central de notificações';
      res.status(500).json({ error: msg });
    }
  };

  disparar = async (_req: Request, res: Response): Promise<void> => {
    try {
      const status = await this.whatsAppGateway.checkInstanceStatus();
      if (status.available === false) {
        res.status(409).json({
          error: 'Os disparos só podem ser feitos pela máquina-sede. Abra o sistema no computador da loja.',
        });
        return;
      }
      if (status.state !== 'open') {
        res.status(409).json({
          error: 'WhatsApp desconectado. Conecte o WhatsApp antes de disparar as cobranças.',
        });
        return;
      }

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
      const status = await this.whatsAppGateway.checkInstanceStatus();

      // Na própria sede o estado local é a verdade
      if (status.available !== false) {
        res.status(200).json(status);
        return;
      }

      // Painel remoto (ex.: Vercel): mostra o que a sede informou pelo Supabase
      res.status(200).json(await this.getRemoteSedeStatus());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao checar status do WhatsApp';
      res.status(500).json({ error: msg });
    }
  };

  private async getRemoteSedeStatus(): Promise<{
    state: ConnectionStatus['state'];
    available: false;
    sede: { online: boolean; lastSeen: string | null } | null;
  }> {
    try {
      const record = await this.sedeStatusRepo?.getStatus();
      if (!record) {
        return { state: 'close', available: false, sede: null };
      }

      const lastSeen = record.atualizado_em;
      const online = lastSeen !== null && Date.now() - new Date(lastSeen).getTime() < SEDE_ONLINE_WINDOW_MS;

      return {
        state: online ? record.estado_whatsapp : 'close',
        available: false,
        sede: { online, lastSeen },
      };
    } catch {
      // Tabela ainda não criada ou banco indisponível: o estado da sede fica desconhecido
      return { state: 'close', available: false, sede: null };
    }
  }

  getWhatsAppQrCode = async (_req: Request, res: Response): Promise<void> => {
    try {
      const qrData = await this.whatsAppGateway.getQrCode();
      res.status(200).json(qrData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar QR Code do WhatsApp';
      res.status(500).json({ error: msg });
    }
  };
}
