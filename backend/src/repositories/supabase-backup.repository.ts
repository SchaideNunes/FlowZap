import { SupabaseClient } from '@supabase/supabase-js';
import { BackupRow, BackupTable, IBackupRepository } from './backup.repository.interface.js';

const PAGE_SIZE = 1000;
const IMPORT_BATCH = 500;

export class SupabaseBackupRepository implements IBackupRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async exportTable(table: BackupTable): Promise<BackupRow[]> {
    const rows: BackupRow[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await this.client
        .from(table)
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Erro ao ler a tabela ${table} para o backup: ${error.message}`);
      }

      const page = (data || []) as BackupRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    return rows;
  }

  async importTable(table: BackupTable, rows: BackupRow[]): Promise<void> {
    for (let start = 0; start < rows.length; start += IMPORT_BATCH) {
      const { error } = await this.client
        .from(table)
        .upsert(rows.slice(start, start + IMPORT_BATCH), { onConflict: 'id' });

      if (error) {
        throw new Error(`Erro ao restaurar a tabela ${table}: ${error.message}`);
      }
    }
  }

  async fixSequences(): Promise<void> {
    const { error } = await this.client.rpc('flowzap_ajustar_sequencias');

    if (error) {
      throw new Error(`Erro ao ajustar as sequências: ${error.message}`);
    }
  }
}
