import { WhatsAppConnectionState } from '../services/whatsapp-gateway.interface.js';

export interface SedeStatusRecord {
  estado_whatsapp: WhatsAppConnectionState;
  /** Último sinal de vida da máquina-sede (ISO). */
  atualizado_em: string | null;
  /** Data (YYYY-MM-DD) da última rotina diária de cobrança executada. */
  ultima_rotina_data: string | null;
}

/**
 * Estado compartilhado da máquina-sede, gravado no Supabase para que o painel hospedado
 * na nuvem saiba se a sede está ligada e se a rotina do dia já rodou.
 */
export interface ISedeStatusRepository {
  getStatus(): Promise<SedeStatusRecord | null>;
  saveHeartbeat(state: WhatsAppConnectionState, at: Date): Promise<void>;
  markRoutineRun(date: string): Promise<void>;
}
