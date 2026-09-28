import { EvolutionService } from './evolution.service.js';

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
}

export class MessageQueueService {
  private evolution: EvolutionService;
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private minDelayMs: number;
  private maxDelayMs: number;
  private simulateTyping: boolean;
  private typingDurationMs: number;

  constructor(evolution: EvolutionService, config: QueueConfig = {}) {
    this.evolution = evolution;
    this.minDelayMs = config.minDelayMs ?? 8000;
    this.maxDelayMs = config.maxDelayMs ?? 20000;
    this.simulateTyping = config.simulateTyping ?? true;
    this.typingDurationMs = config.typingDurationMs ?? 2500;
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
      // 1. Simulação de digitação (Anti-ban)
      if (this.simulateTyping) {
        await this.evolution.sendPresence(currentItem.whatsapp, 'composing');
        await this.wait(this.typingDurationMs);
      }

      // 2. Envio da mensagem
      const response = await this.evolution.sendText(currentItem.whatsapp, currentItem.message);

      if (currentItem.onSuccess) {
        await currentItem.onSuccess(response);
      }
    } catch (err: any) {
      if (currentItem.onError) {
        await currentItem.onError(err);
      }
    } finally {
      // 3. Jitter / delay anti-ban aleatório antes de processar o próximo item da fila
      if (this.queue.length > 0) {
        const delay = this.getRandomDelay();
        await this.wait(delay);
      }
      // Processa o próximo
      this.processNext();
    }
  }
}
