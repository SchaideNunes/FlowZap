/**
 * Tabelas que entram no backup, na ordem em que precisam ser regravadas (clientes antes de
 * vendas, vendas antes do histórico). A tabela de usuários fica de fora: contém senhas.
 */
export const BACKUP_TABLES = [
  'clientes',
  'vendas',
  'historico_mensagens',
  'contas_a_pagar',
  'configuracoes',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupRow = Record<string, unknown>;

export interface IBackupRepository {
  /** Todas as linhas da tabela (sem o limite de 1000 linhas por consulta). */
  exportTable(table: BackupTable): Promise<BackupRow[]>;
  /** Regrava as linhas pelo id: o que existe é atualizado, o que falta é recriado. */
  importTable(table: BackupTable, rows: BackupRow[]): Promise<void>;
  /** Depois de regravar com ids fixos, alinha os contadores de id do banco. */
  fixSequences(): Promise<void>;
}
