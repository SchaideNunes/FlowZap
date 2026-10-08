import { ISedeStatusRepository } from '../repositories/sede-status.repository.interface.js';
import { IWhatsAppGateway } from './whatsapp-gateway.interface.js';

export interface SedeHeartbeatConfig {
  intervalMs?: number;
  log?: (message: string) => void;
}

/**
 * Avisa periodicamente o Supabase que a máquina-sede está ligada e em que estado está o
 * WhatsApp. É só informativo: falhas aqui nunca podem afetar o envio de cobranças.
 */
export class SedeHeartbeatService {
  private repo: ISedeStatusRepository;
  private gateway: IWhatsAppGateway;
  private intervalMs: number;
  private log: (message: string) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private failing = false;

  constructor(repo: ISedeStatusRepository, gateway: IWhatsAppGateway, config: SedeHeartbeatConfig = {}) {
    this.repo = repo;
    this.gateway = gateway;
    this.intervalMs = config.intervalMs ?? 60000;
    this.log = config.log ?? ((message) => console.warn(`[Sede] ${message}`));
  }

  start(): void {
    if (this.timer) return;
    void this.beat();
    this.timer = setInterval(() => void this.beat(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async beat(): Promise<void> {
    try {
      const { state } = await this.gateway.checkInstanceStatus();
      await this.repo.saveHeartbeat(state, new Date());
      this.failing = false;
    } catch (err) {
      if (!this.failing) {
        this.log(
          `Não foi possível enviar o sinal de vida (o painel online não mostrará o estado da sede): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
      this.failing = true;
    }
  }
}
