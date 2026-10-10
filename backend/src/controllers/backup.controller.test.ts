import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { BackupController } from './backup.controller.js';
import { BackupService } from '../services/backup.service.js';

describe('BackupController', () => {
  let service: { createSnapshot: ReturnType<typeof vi.fn>; listLocalBackups: ReturnType<typeof vi.fn>; isAutomatic: ReturnType<typeof vi.fn> };
  let sedeRepo: { getStatus: ReturnType<typeof vi.fn> };
  let controller: BackupController;
  let res: Partial<Response>;

  const snapshot = {
    app: 'flowzap',
    versao: 1,
    gerado_em: '2026-10-09T13:00:00.000Z',
    totais: { clientes: 1 },
    tabelas: { clientes: [{ id: 1 }] },
  };

  beforeEach(() => {
    service = {
      createSnapshot: vi.fn().mockResolvedValue(snapshot),
      listLocalBackups: vi.fn().mockReturnValue([{ arquivo: 'flowzap-backup-2026-10-09.json', data: '2026-10-09', tamanho: 10 }]),
      isAutomatic: vi.fn().mockReturnValue(true),
    };
    sedeRepo = { getStatus: vi.fn().mockResolvedValue({ ultimo_backup_em: '2026-10-09T12:00:00.000Z' }) };
    controller = new BackupController(service as unknown as BackupService, sedeRepo as any);
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() };
  });

  it('GET /backup devolve o backup completo como arquivo para baixar', async () => {
    await controller.download({} as Request, res as Response);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="flowzap-backup-2026-10-09.json"'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(snapshot);
  });

  it('GET /backup devolve 500 quando não consegue ler o banco', async () => {
    service.createSnapshot.mockRejectedValue(new Error('banco fora do ar'));

    await controller.download({} as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'banco fora do ar' });
  });

  it('GET /backup/status informa o último backup automático e quantos estão guardados', async () => {
    await controller.status({} as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ultimo_backup_em: '2026-10-09T12:00:00.000Z',
      automatico_neste_computador: true,
      guardados: 1,
    });
  });

  it('GET /backup/status usa a data do arquivo local quando o banco não tem o registro', async () => {
    sedeRepo.getStatus.mockResolvedValue({ ultimo_backup_em: null });
    service.listLocalBackups.mockReturnValue([
      { arquivo: 'flowzap-backup-2026-10-09.json', data: '2026-10-09', tamanho: 10, gravado_em: '2026-10-09T11:30:00.000Z' },
    ]);

    await controller.status({} as Request, res as Response);

    expect(vi.mocked(res.json!).mock.calls[0][0].ultimo_backup_em).toBe('2026-10-09T11:30:00.000Z');
  });

  it('GET /backup/status funciona sem o registro da sede (coluna ainda não criada)', async () => {
    sedeRepo.getStatus.mockRejectedValue(new Error('x'));
    service.isAutomatic.mockReturnValue(false);
    service.listLocalBackups.mockReturnValue([]);

    await controller.status({} as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({
      ultimo_backup_em: null,
      automatico_neste_computador: false,
      guardados: 0,
    });
  });
});
