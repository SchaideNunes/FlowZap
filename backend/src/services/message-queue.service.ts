import { IWhatsAppGateway, NumeroSemWhatsAppError } from './whatsapp-gateway.interface.js';

export interface QueueItem {
  id?: string;
  whatsapp: string;
  message: string;
  onSuccess?: (response: any) => Promise<void> | void;
  onError?: (error: any) => Promise<void> | void;
}

export interface QueueConfig {
  minDelayMs?: number;
  maxDelayMs?: number;
  simulateTyping?: boolean;
  typingDurationMs?: number;
  /** Intervalo entre verificações enquanto o WhatsApp está desconectado. */
  disconnectedRetryMs?: number;
}

export class MessageQueueService {
  private gateway: IWhatsAppGateway;
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private minDelayMs: number;
  private maxDelayMs: number;
  private simulateTyping: boolean;
  private typingDurationMs: number;
  private disconnectedRetryMs: number;

  constructor(gateway: IWhatsAppGateway, config: QueueConfig = {}) {
    this.gateway = gateway;
    this.minDelayMs = config.minDelayMs ?? 8000;
    this.maxDelayMs = config.maxDelayMs ?? 20000;
    this.simulateTyping = config.simulateTyping ?? true;
    this.typingDurationMs = config.typingDurationMs ?? 2500;
    this.disconnectedRetryMs = config.disconnectedRetryMs ?? 15000;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getTotalPending(): number {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }

  isBusy(): boolean {
    return this.isProcessing;
  }

  enqueue(item: QueueItem): void {
    this.queue.push(item);
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  private getRandomDelay(): number {
    return Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async isConnected(): Promise<boolean> {
    try {
      const status = await this.gateway.checkInstanceStatus();
      return status?.state === 'open';
    } catch {
      return false;
    }
  }

  /**
   * Mensagens não falham por queda de conexão: ficam aguardando o WhatsApp reconectar.
   */
  private async waitUntilConnected(): Promise<void> {
    while (!(await this.isConnected())) {
      await this.wait(this.disconnectedRetryMs);
    }
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const currentItem = this.queue.shift();
    if (!currentItem) {
      this.isProcessing = false;
      return;
    }

    try {
      await this.waitUntilConnected();

      // 1. Não envia para número sem WhatsApp (sinal ruim para o anti-ban)
      if (!(await this.gateway.numberExists(currentItem.whatsapp))) {
        throw new NumeroSemWhatsAppError(currentItem.whatsapp);
      }

      // 2. Simulação de digitação (Anti-ban)
      if (this.simulateTyping) {
        await this.gateway.sendPresence(currentItem.whatsapp, 'composing');
        await this.wait(this.typingDurationMs);
      }

      // 3. Envio da mensagem
      const response = await this.gateway.sendText(currentItem.whatsapp, currentItem.message);

      if (currentItem.onSuccess) {
        await currentItem.onSuccess(response);
      }
    } catch (err: any) {
      if (currentItem.onError) {
        await currentItem.onError(err);
      }
    } finally {
      // 4. Jitter / delay anti-ban aleatório antes de processar o próximo item da fila
      if (this.queue.length > 0) {
        const delay = this.getRandomDelay();
        await this.wait(delay);
      }
      // Processa o próximo
      this.processNext();
    }
  }
}
