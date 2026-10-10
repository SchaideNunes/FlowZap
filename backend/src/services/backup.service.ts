import fs from 'fs';
import path from 'path';
import {
  BACKUP_TABLES,
  BackupRow,
  BackupTable,
  IBackupRepository,
} from '../repositories/backup.repository.interface.js';
import { ISedeStatusRepository } from '../repositories/sede-status.repository.interface.js';
import { formatDateToISO } from '../utils/date-calculator.js';

export interface BackupSnapshot {
  app: 'flowzap';
  versao: 1;
  gerado_em: string;
  totais: Record<BackupTable, number>;
  tabelas: Record<BackupTable, BackupRow[]>;
}

export interface LocalBackup {
  arquivo: string;
  /** Dia do backup (YYYY-MM-DD). */
  data: string;
  tamanho: number;
  /** Quando o arquivo foi gravado (ISO). */
  gravado_em: string;
}

export interface BackupServiceOptions {
  /** Pasta dos backups automáticos. Sem ela (painel online) nada é gravado em disco. */
  dir?: string;
  /** Quantos backups diários manter. */
  keep?: number;
  sedeStatusRepo?: ISedeStatusRepository;
  log?: (message: string) => void;
}

const FILE_PATTERN = /^flowzap-backup-(\d{4}-\d{2}-\d{2})\.json$/;

export function backupFileName(date: Date): string {
  return `flowzap-backup-${formatDateToISO(date)}.json`;
}

export class BackupService {
  private repo: IBackupRepository;
  private dir?: string;
  private keep: number;
  private sedeStatusRepo?: ISedeStatusRepository;
  private log: (message: string) => void;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(repo: IBackupRepository, options: BackupServiceOptions = {}) {
    this.repo = repo;
    this.dir = options.dir;
    this.keep = options.keep ?? 30;
    this.sedeStatusRepo = options.sedeStatusRepo;
    this.log = options.log ?? ((message) => console.log(`[Backup] ${message}`));
  }

  /** true na máquina-sede, onde o backup diário é gravado em disco. */
  isAutomatic(): boolean {
    return Boolean(this.dir);
  }

  /**
   * Cópia completa dos dados do sistema (sem a tabela de usuários).
   */
  async createSnapshot(now: Date = new Date()): Promise<BackupSnapshot> {
    const tabelas = {} as Record<BackupTable, BackupRow[]>;
    const totais = {} as Record<BackupTable, number>;

    for (const table of BACKUP_TABLES) {
      tabelas[table] = await this.repo.exportTable(table);
      totais[table] = tabelas[table].length;
    }

    return { app: 'flowzap', versao: 1, gerado_em: now.toISOString(), totais, tabelas };
  }

  /**
   * Grava o backup do dia na pasta local e apaga os mais antigos que o limite.
   * Devolve null quando nada foi gravado (sem pasta, ou banco vazio com backups já guardados).
   */
  async saveToDisk(now: Date = new Date()): Promise<{ arquivo: string; totais: BackupSnapshot['totais'] } | null> {
    if (!this.dir) return null;

    const snapshot = await this.createSnapshot(now);

    // Um banco que aparece vazio depois de já ter tido dados é sinal de problema: não grava
    // por cima da rotina nem deixa a limpeza apagar os backups bons.
    const totalRows = Object.values(snapshot.totais).reduce((acc, n) => acc + n, 0);
    if (totalRows === 0 && this.listLocalBackups().length > 0) {
      this.log('O banco veio vazio. Backup de hoje não gravado e os anteriores foram preservados.');
      return null;
    }

    fs.mkdirSync(this.dir, { recursive: true });
    const arquivo = backupFileName(now);
    const finalPath = path.join(this.dir, arquivo);
    const tempPath = `${finalPath}.tmp`;

    // Grava em arquivo temporário e renomeia: uma queda de energia não deixa backup pela metade
    fs.writeFileSync(tempPath, JSON.stringify(snapshot));
    fs.renameSync(tempPath, finalPath);

    this.prune();

    try {
      await this.sedeStatusRepo?.markBackup(now);
    } catch {
      // Informativo: o painel online só não mostra a data do último backup
    }

    this.log(`Backup gravado: ${arquivo}`);
    return { arquivo, totais: snapshot.totais };
  }

  /**
   * Garante um backup por dia. Devolve true quando o backup foi feito agora.
   */
  async runDailyIfNeeded(now: Date = new Date()): Promise<boolean> {
    if (!this.dir) return false;
    if (fs.existsSync(path.join(this.dir, backupFileName(now)))) return false;

    return (await this.saveToDisk(now)) !== null;
  }

  listLocalBackups(): LocalBackup[] {
    if (!this.dir || !fs.existsSync(this.dir)) return [];

    return fs
      .readdirSync(this.dir)
      .map((arquivo) => ({ arquivo, match: FILE_PATTERN.exec(arquivo) }))
      .filter((entry): entry is { arquivo: string; match: RegExpExecArray } => entry.match !== null)
      .map(({ arquivo, match }) => {
        const stat = fs.statSync(path.join(this.dir!, arquivo));
        return { arquivo, data: match[1], tamanho: stat.size, gravado_em: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }

  private prune(): void {
    for (const old of this.listLocalBackups().slice(this.keep)) {
      fs.rmSync(path.join(this.dir!, old.arquivo), { force: true });
    }
  }

  /**
   * Regrava no banco os dados de um backup. Não apaga o que foi criado depois dele.
   */
  async restore(snapshot: BackupSnapshot): Promise<{ totais: BackupSnapshot['totais']; aviso: string | null }> {
    const valid =
      snapshot &&
      snapshot.app === 'flowzap' &&
      snapshot.tabelas &&
      typeof snapshot.tabelas === 'object' &&
      BACKUP_TABLES.every((table) => snapshot.tabelas[table] === undefined || Array.isArray(snapshot.tabelas[table]));

    if (!valid) {
      throw new Error('O arquivo não é um backup do Flow-Zap.');
    }

    const totais = {} as BackupSnapshot['totais'];
    for (const table of BACKUP_TABLES) {
      const rows = snapshot.tabelas[table] || [];
      await this.repo.importTable(table, rows);
      totais[table] = rows.length;
    }

    let aviso: string | null = null;
    try {
      await this.repo.fixSequences();
    } catch (error) {
      aviso =
        'Dados restaurados, mas os contadores de id não foram ajustados: execute database/migration_backup.sql no ' +
        `Supabase e rode a restauração de novo. (${error instanceof Error ? error.message : String(error)})`;
    }

    return { totais, aviso };
  }

  /**
   * Na máquina-sede: faz o backup do dia ao ligar e confere de hora em hora.
   */
  startAutomatic(intervalMs: number = 60 * 60 * 1000): void {
    if (!this.dir || this.timer) return;

    const tick = () =>
      void this.runDailyIfNeeded().catch((error) =>
        this.log(`Falha no backup automático: ${error instanceof Error ? error.message : String(error)}`)
      );

    tick();
    this.timer = setInterval(tick, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
