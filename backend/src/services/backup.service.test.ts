import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BackupService, BackupSnapshot } from './backup.service.js';
import { IBackupRepository } from '../repositories/backup.repository.interface.js';

describe('BackupService', () => {
  let dir: string;
  let repo: {
    exportTable: ReturnType<typeof vi.fn>;
    importTable: ReturnType<typeof vi.fn>;
    fixSequences: ReturnType<typeof vi.fn>;
  };
  let sedeRepo: { markBackup: ReturnType<typeof vi.fn> };
  let data: Record<string, Record<string, unknown>[]>;

  const day = (d: number, hour = 10) => new Date(2026, 9, d, hour, 0); // outubro/2026, horário local
  const build = (options: { dir?: string; keep?: number } = { dir: undefined }) =>
    new BackupService(repo as unknown as IBackupRepository, {
      dir: 'dir' in options ? options.dir : dir,
      keep: options.keep,
      sedeStatusRepo: sedeRepo as any,
      log: () => {},
    });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowzap-backup-'));
    data = {
      clientes: [{ id: 1, nome: 'Maria' }],
      vendas: [{ id: 10, cliente_id: 1, valor: 100 }],
      historico_mensagens: [{ id: 5, venda_id: 10, tipo: 'vencido' }],
      contas_a_pagar: [],
      configuracoes: [{ id: 1, envio_automatico: true, mensagens: {} }],
    };
    repo = {
      exportTable: vi.fn().mockImplementation(async (table: string) => data[table]),
      importTable: vi.fn().mockResolvedValue(undefined),
      fixSequences: vi.fn().mockResolvedValue(undefined),
    };
    sedeRepo = { markBackup: vi.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('createSnapshot', () => {
    it('reúne todas as tabelas de dados, com totais e data', async () => {
      const snapshot = await build({ dir }).createSnapshot(day(9));

      expect(snapshot.app).toBe('flowzap');
      expect(snapshot.versao).toBe(1);
      expect(snapshot.gerado_em).toBe(day(9).toISOString());
      expect(snapshot.tabelas.clientes).toEqual([{ id: 1, nome: 'Maria' }]);
      expect(snapshot.totais).toEqual({
        clientes: 1,
        vendas: 1,
        historico_mensagens: 1,
        contas_a_pagar: 0,
        configuracoes: 1,
      });
    });

    it('não inclui a tabela de usuários (senhas)', async () => {
      await build({ dir }).createSnapshot(day(9));

      expect(repo.exportTable).not.toHaveBeenCalledWith('usuarios');
    });
  });

  describe('saveToDisk', () => {
    it('grava um arquivo por dia, com o conteúdo completo, e registra na sede', async () => {
      const result = await build({ dir }).saveToDisk(day(9));

      expect(result?.arquivo).toBe('flowzap-backup-2026-10-09.json');
      const saved = JSON.parse(fs.readFileSync(path.join(dir, 'flowzap-backup-2026-10-09.json'), 'utf8'));
      expect(saved.tabelas.vendas).toEqual([{ id: 10, cliente_id: 1, valor: 100 }]);
      expect(sedeRepo.markBackup).toHaveBeenCalledWith(day(9));
    });

    it('guarda só os backups mais recentes', async () => {
      const service = build({ dir, keep: 3 });
      for (const d of [5, 6, 7, 8, 9]) await service.saveToDisk(day(d));

      expect(fs.readdirSync(dir).sort()).toEqual([
        'flowzap-backup-2026-10-07.json',
        'flowzap-backup-2026-10-08.json',
        'flowzap-backup-2026-10-09.json',
      ]);
    });

    it('se o banco vier vazio e já houver backups, não grava nem apaga nada', async () => {
      const service = build({ dir, keep: 2 });
      await service.saveToDisk(day(7));
      await service.saveToDisk(day(8));
      data.clientes = [];
      data.vendas = [];
      data.historico_mensagens = [];
      data.configuracoes = [];

      const result = await service.saveToDisk(day(9));

      expect(result).toBeNull();
      expect(fs.readdirSync(dir).sort()).toEqual(['flowzap-backup-2026-10-07.json', 'flowzap-backup-2026-10-08.json']);
    });

    it('não deixa arquivo pela metade quando a leitura do banco falha', async () => {
      repo.exportTable.mockRejectedValue(new Error('banco fora do ar'));

      await expect(build({ dir }).saveToDisk(day(9))).rejects.toThrow(/banco fora do ar/);
      expect(fs.readdirSync(dir)).toEqual([]);
    });

    it('continua gravando mesmo se não conseguir registrar na sede', async () => {
      sedeRepo.markBackup.mockRejectedValue(new Error('coluna inexistente'));

      const result = await build({ dir }).saveToDisk(day(9));

      expect(result?.arquivo).toBe('flowzap-backup-2026-10-09.json');
    });

    it('sem pasta configurada (painel online) não grava nada', async () => {
      expect(await build({ dir: undefined }).saveToDisk(day(9))).toBeNull();
      expect(repo.exportTable).not.toHaveBeenCalled();
    });
  });

  describe('runDailyIfNeeded', () => {
    it('faz o backup do dia uma única vez', async () => {
      const service = build({ dir });

      expect(await service.runDailyIfNeeded(day(9, 8))).toBe(true);
      expect(await service.runDailyIfNeeded(day(9, 15))).toBe(false);
      expect(await service.runDailyIfNeeded(day(10, 8))).toBe(true);
      expect(fs.readdirSync(dir)).toHaveLength(2);
    });
  });

  describe('listLocalBackups', () => {
    it('lista do mais recente para o mais antigo e ignora outros arquivos', async () => {
      const service = build({ dir });
      await service.saveToDisk(day(8));
      await service.saveToDisk(day(9));
      fs.writeFileSync(path.join(dir, 'anotacoes.txt'), 'x');

      const list = service.listLocalBackups();

      expect(list.map((b) => b.arquivo)).toEqual(['flowzap-backup-2026-10-09.json', 'flowzap-backup-2026-10-08.json']);
      expect(list[0].data).toBe('2026-10-09');
      expect(list[0].tamanho).toBeGreaterThan(0);
      expect(new Date(list[0].gravado_em).getTime()).toBeGreaterThan(0);
    });

    it('devolve lista vazia sem pasta configurada', () => {
      expect(build({ dir: undefined }).listLocalBackups()).toEqual([]);
    });
  });

  describe('restore', () => {
    let snapshot: BackupSnapshot;

    beforeEach(async () => {
      snapshot = await build({ dir }).createSnapshot(day(9));
      repo.exportTable.mockClear();
    });

    it('regrava as tabelas na ordem das dependências e ajusta as sequências', async () => {
      const result = await build({ dir }).restore(snapshot);

      expect(repo.importTable.mock.calls.map((call) => call[0])).toEqual([
        'clientes',
        'vendas',
        'historico_mensagens',
        'contas_a_pagar',
        'configuracoes',
      ]);
      expect(repo.importTable).toHaveBeenCalledWith('vendas', [{ id: 10, cliente_id: 1, valor: 100 }]);
      expect(repo.fixSequences).toHaveBeenCalledTimes(1);
      expect(result.totais.clientes).toBe(1);
      expect(result.aviso).toBeNull();
    });

    it('recusa arquivo que não é um backup do sistema', async () => {
      await expect(build({ dir }).restore({ qualquer: 'coisa' } as any)).rejects.toThrow(/não é um backup/i);
      await expect(build({ dir }).restore({ ...snapshot, tabelas: { clientes: 'x' } } as any)).rejects.toThrow(
        /não é um backup/i
      );
      expect(repo.importTable).not.toHaveBeenCalled();
    });

    it('conclui com aviso quando não consegue ajustar as sequências', async () => {
      repo.fixSequences.mockRejectedValue(new Error('function does not exist'));

      const result = await build({ dir }).restore(snapshot);

      expect(result.aviso).toMatch(/migration_backup\.sql/);
    });
  });
});
