import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfiguracaoRepository } from './supabase-configuracao.repository.js';

describe('SupabaseConfiguracaoRepository', () => {
  let mockClient: any;
  let repo: SupabaseConfiguracaoRepository;

  beforeEach(() => {
    mockClient = { from: vi.fn() };
    repo = new SupabaseConfiguracaoRepository(mockClient as SupabaseClient);
  });

  it('lê a linha única de configuracoes', async () => {
    const row = { id: 1, envio_automatico: false, mensagens: { vencido: 'x' } };
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    mockClient.from.mockReturnValue(chain);

    const result = await repo.get();

    expect(mockClient.from).toHaveBeenCalledWith('configuracoes');
    expect(chain.eq).toHaveBeenCalledWith('id', 1);
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(result).toEqual({ envio_automatico: false, mensagens: { vencido: 'x' }, chave_pix: null });
  });

  it('lê a chave Pix quando a coluna existe', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 1, envio_automatico: true, mensagens: {}, chave_pix: 'k' }, error: null }),
    };
    mockClient.from.mockReturnValue(chain);

    expect((await repo.get())?.chave_pix).toBe('k');
  });

  it('grava a chave Pix só quando ela vem na configuração', async () => {
    const chain: any = { upsert: vi.fn().mockResolvedValue({ error: null }) };
    mockClient.from.mockReturnValue(chain);

    await repo.save({ envio_automatico: true, mensagens: {} });
    await repo.save({ envio_automatico: true, mensagens: {}, chave_pix: null });

    expect(chain.upsert.mock.calls[0][0]).toEqual({ id: 1, envio_automatico: true, mensagens: {} });
    expect(chain.upsert.mock.calls[1][0]).toEqual({ id: 1, envio_automatico: true, mensagens: {}, chave_pix: null });
  });

  it('devolve null quando ainda não há registro', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockClient.from.mockReturnValue(chain);

    expect(await repo.get()).toBeNull();
  });

  it('lança erro quando a leitura falha', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'relation does not exist' } }),
    };
    mockClient.from.mockReturnValue(chain);

    await expect(repo.get()).rejects.toThrow(/does not exist/);
  });

  it('grava a configuração na linha única', async () => {
    const chain: any = { upsert: vi.fn().mockResolvedValue({ error: null }) };
    mockClient.from.mockReturnValue(chain);
    const config = { envio_automatico: false, mensagens: { vencido: 'x' } };

    const result = await repo.save(config);

    expect(chain.upsert).toHaveBeenCalledWith({ id: 1, ...config }, { onConflict: 'id' });
    expect(result).toEqual(config);
  });

  it('lança erro quando a gravação falha', async () => {
    const chain: any = { upsert: vi.fn().mockResolvedValue({ error: { message: 'falhou' } }) };
    mockClient.from.mockReturnValue(chain);

    await expect(repo.save({ envio_automatico: true, mensagens: {} })).rejects.toThrow(/falhou/);
  });
});
