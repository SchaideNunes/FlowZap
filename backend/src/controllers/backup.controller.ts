import { Request, Response } from 'express';
import { BackupService, backupFileName } from '../services/backup.service.js';
import { ISedeStatusRepository } from '../repositories/sede-status.repository.interface.js';

export class BackupController {
  private service: BackupService;
  private sedeStatusRepo: ISedeStatusRepository;

  constructor(service: BackupService, sedeStatusRepo: ISedeStatusRepository) {
    this.service = service;
    this.sedeStatusRepo = sedeStatusRepo;
  }

  download = async (_req: Request, res: Response): Promise<void> => {
    try {
      const snapshot = await this.service.createSnapshot();
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${backupFileName(new Date(snapshot.gerado_em))}"`
      );
      res.status(200).json(snapshot);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar o backup';
      res.status(500).json({ error: msg });
    }
  };

  status = async (_req: Request, res: Response): Promise<void> => {
    let ultimoBackupEm: string | null = null;
    try {
      ultimoBackupEm = (await this.sedeStatusRepo.getStatus())?.ultimo_backup_em ?? null;
    } catch {
      // Sem o registro da sede o painel só não mostra a data
    }

    // Na máquina-sede os próprios arquivos dizem quando foi o último backup
    const locais = this.service.listLocalBackups();

    res.status(200).json({
      ultimo_backup_em: ultimoBackupEm ?? locais[0]?.gravado_em ?? null,
      automatico_neste_computador: this.service.isAutomatic(),
      guardados: locais.length,
    });
  };
}
