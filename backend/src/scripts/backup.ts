/**
 * Backup e restauração pela linha de comando (máquina-sede).
 *
 *   npm run backup:agora                      grava o backup de hoje na pasta de backups
 *   npm run backup:restaurar -- <arquivo>     mostra o que o arquivo contém (não altera nada)
 *   npm run backup:restaurar -- <arquivo> --confirmar    regrava os dados no banco
 */
import '../config/env.js';
import fs from 'fs';
import path from 'path';
import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase.js';
import { SupabaseBackupRepository } from '../repositories/supabase-backup.repository.js';
import { SupabaseSedeStatusRepository } from '../repositories/supabase-sede-status.repository.js';
import { BackupService, BackupSnapshot } from '../services/backup.service.js';
import { resolveBackupDir } from '../config/backup-dir.js';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado: confira o arquivo backend/.env.');
  }

  const dir = resolveBackupDir();
  const service = new BackupService(new SupabaseBackupRepository(supabase), {
    dir,
    sedeStatusRepo: new SupabaseSedeStatusRepository(supabase),
  });

  if (command === 'agora') {
    const result = await service.saveToDisk();
    console.log(result ? `Backup gravado em ${path.join(dir, result.arquivo)}` : 'Nada foi gravado.');
    if (result) console.table(result.totais);
    return;
  }

  if (command === 'restaurar') {
    const file = args.find((arg) => !arg.startsWith('--'));
    if (!file) throw new Error('Informe o arquivo de backup. Ex.: npm run backup:restaurar -- backups/arquivo.json');

    const snapshot = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as BackupSnapshot;
    console.log(`Backup gerado em ${snapshot.gerado_em}`);
    console.table(snapshot.totais);

    if (!args.includes('--confirmar')) {
      console.log('Nada foi alterado. Para regravar esses dados no banco, repita o comando com --confirmar.');
      return;
    }

    const result = await service.restore(snapshot);
    console.log('Restauração concluída.');
    console.table(result.totais);
    if (result.aviso) console.warn(result.aviso);
    return;
  }

  throw new Error('Comando desconhecido. Use "agora" ou "restaurar".');
}

main().catch((error) => {
  console.error(`[Backup] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
