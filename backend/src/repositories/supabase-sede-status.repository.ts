import { SupabaseClient } from '@supabase/supabase-js';
import { WhatsAppConnectionState } from '../services/whatsapp-gateway.interface.js';
import { ISedeStatusRepository, SedeStatusRecord } from './sede-status.repository.interface.js';

const TABLE = 'sede_status';
const ROW_ID = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  async claimSede(sedeId: string, nome: string, force: boolean): Promise<boolean> {
    // O identificador entra no texto do filtro: só passa se for um UUID
    if (!UUID.test(sedeId)) {
      throw new Error('Identificador de sede inválido.');
    }

    // Garante a linha única sem mexer em uma que já exista
    await this.client.from(TABLE).upsert({ id: ROW_ID }, { onConflict: 'id', ignoreDuplicates: true });

    // A condição vai junto com a gravação: duas máquinas ao mesmo tempo não ganham as duas
    const update = this.client.from(TABLE).update({ sede_id: sedeId, sede_nome: nome }).eq('id', ROW_ID);
    const { data, error } = await (force ? update : update.or(`sede_id.is.null,sede_id.eq.${sedeId}`)).select('id');

    if (error) {
      throw new Error(`Erro ao conferir a trava da sede: ${error.message}`);
    }

    return Array.isArray(data) && data.length > 0;
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
