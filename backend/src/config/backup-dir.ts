import path from 'path';

/**
 * Pasta dos backups automáticos da máquina-sede. Pode ser trocada por BACKUP_DIR, por
 * exemplo para uma pasta sincronizada com a nuvem (Google Drive, OneDrive) ou um pendrive.
 */
export function resolveBackupDir(): string {
  return path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
}
