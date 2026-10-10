import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseBackupRepository } from './supabase-backup.repository.js';

describe('SupabaseBackupRepository', () => {
  let mockClient: any;
  let repo: SupabaseBackupRepository;

  beforeEach(() => {
    mockClient = { from: vi.fn(), rpc: vi.fn() };
    repo = new SupabaseBackupRepository(mockClient as SupabaseClient);
  });

  const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ id: from + i }));

  it('lê a tabela inteira em páginas (o Supabase devolve no máximo 1000 linhas por consulta)', async () => {
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: rows(1, 1000), error: null })
      .mockResolvedValueOnce({ data: rows(1001, 250), error: null });
    const chain: any = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range };
    mockClient.from.mockReturnValue(chain);

    const result = await repo.exportTable('vendas');

    expect(mockClient.from).toHaveBeenCalledWith('vendas');
    expect(chain.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(result).toHaveLength(1250);
  });

  it('lança erro quando a leitura falha', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: { message: 'falhou' } }),
    };
    mockClient.from.mockReturnValue(chain);

    await expect(repo.exportTable('clientes')).rejects.toThrow(/clientes.*falhou/);
  });

  it('regrava as linhas em lotes, pelo id', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockClient.from.mockReturnValue({ upsert });

    await repo.importTable('clientes', rows(1, 1200));

    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert.mock.calls[0][0]).toHaveLength(500);
    expect(upsert.mock.calls[2][0]).toHaveLength(200);
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'id' });
  });

  it('não consulta o banco quando não há linhas para regravar', async () => {
    await repo.importTable('clientes', []);

    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it('lança erro quando a regravação falha', async () => {
    mockClient.from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: { message: 'falhou' } }) });

    await expect(repo.importTable('vendas', rows(1, 1))).rejects.toThrow(/vendas.*falhou/);
  });

  it('ajusta as sequências pela função do banco', async () => {
    mockClient.rpc.mockResolvedValue({ error: null });

    await repo.fixSequences();

    expect(mockClient.rpc).toHaveBeenCalledWith('flowzap_ajustar_sequencias');
  });

  it('lança erro quando a função do banco não existe', async () => {
    mockClient.rpc.mockResolvedValue({ error: { message: 'function does not exist' } });

    await expect(repo.fixSequences()).rejects.toThrow(/does not exist/);
  });
});
