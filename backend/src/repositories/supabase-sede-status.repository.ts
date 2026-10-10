import { SupabaseClient } from '@supabase/supabase-js';
import { WhatsAppConnectionState } from '../services/whatsapp-gateway.interface.js';
import { ISedeStatusRepository, SedeStatusRecord } from './sede-status.repository.interface.js';

const TABLE = 'sede_status';
const ROW_ID = 1;

export class SupabaseSedeStatusRepository implements ISedeStatusRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getStatus(): Promise<SedeStatusRecord | null> {
    const { data, error } = await this.client.from(TABLE).select('*').eq('id', ROW_ID).maybeSingle();

    if (error) {
      throw new Error(`Erro ao ler o status da sede: ${error.message}`);
    }

    return (data as SedeStatusRecord | null) ?? null;
  }

  async saveHeartbeat(state: WhatsAppConnectionState, at: Date): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .upsert({ id: ROW_ID, estado_whatsapp: state, atualizado_em: at.toISOString() }, { onConflict: 'id' });

    if (error) {
      throw new Error(`Erro ao gravar sinal de vida da sede: ${error.message}`);
    }
  }

  async markRoutineRun(date: string): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .upsert({ id: ROW_ID, ultima_rotina_data: date }, { onConflict: 'id' });

    if (error) {
      throw new Error(`Erro ao registrar a rotina diária: ${error.message}`);
    }
  }

  async markBackup(at: Date): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .upsert({ id: ROW_ID, ultimo_backup_em: at.toISOString() }, { onConflict: 'id' });

    if (error) {
      throw new Error(`Erro ao registrar o backup: ${error.message}`);
    }
  }
}
