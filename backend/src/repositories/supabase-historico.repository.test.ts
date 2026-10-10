import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseHistoricoRepository } from './supabase-historico.repository.js';

describe('SupabaseHistoricoRepository.hasMessageBeenSentForCycle', () => {
  let mockClient: any;
  let repo: SupabaseHistoricoRepository;
  let chain: any;

  beforeEach(() => {
    chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockClient = { from: vi.fn().mockReturnValue(chain) };
    repo = new SupabaseHistoricoRepository(mockClient as SupabaseClient);
  });

  it('considera apenas mensagens dos 20 dias anteriores ao vencimento como do ciclo atual', async () => {
    await repo.hasMessageBeenSentForCycle(1, 'lembrete_1d', '2026-02-28');

    expect(chain.gte).toHaveBeenCalledWith('data_envio', '2026-02-08T00:00:00.000Z');
  });

  it('não confunde o aviso do mês anterior com o do ciclo atual em meses curtos', async () => {
    // Vencimento 28/02 (mês anterior vencia 31/01): o aviso de 1 dia foi em 30/01, 29 dias antes.
    // Com janela de 30 dias ele seria contado como do ciclo atual e bloquearia o novo aviso.
    await repo.hasMessageBeenSentForCycle(1, 'lembrete_1d', '2026-02-28');

    const windowStart = new Date(chain.gte.mock.calls[0][1]).getTime();
    const previousCycleMessage = new Date('2026-01-30T12:00:00Z').getTime();
    expect(previousCycleMessage).toBeLessThan(windowStart);
  });

  it('devolve true quando existe envio no ciclo e false quando não existe', async () => {
    chain.limit.mockResolvedValueOnce({ data: [{ id: 5 }], error: null });
    expect(await repo.hasMessageBeenSentForCycle(1, 'lembrete_2d', '2026-09-18')).toBe(true);

    chain.limit.mockResolvedValueOnce({ data: [], error: null });
    expect(await repo.hasMessageBeenSentForCycle(1, 'lembrete_2d', '2026-09-18')).toBe(false);
  });

  it('lança erro quando a consulta falha', async () => {
    chain.limit.mockResolvedValueOnce({ data: null, error: { message: 'falhou' } });
    await expect(repo.hasMessageBeenSentForCycle(1, 'vencido', '2026-09-18')).rejects.toThrow(/falhou/);
  });
});

describe('SupabaseHistoricoRepository.findPagamentos', () => {
  let repo: SupabaseHistoricoRepository;
  let chain: any;

  beforeEach(() => {
    chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
    };
    const mockClient = { from: vi.fn().mockReturnValue(chain) };
    repo = new SupabaseHistoricoRepository(mockClient as unknown as SupabaseClient);
  });

  it('busca só as confirmações de pagamento, da mais recente para a mais antiga', async () => {
    const result = await repo.findPagamentos(30);

    expect(chain.eq).toHaveBeenCalledWith('tipo', 'confirmacao_manual');
    expect(chain.order).toHaveBeenCalledWith('data_envio', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(30);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('lança erro quando a consulta falha', async () => {
    chain.limit.mockResolvedValueOnce({ data: null, error: { message: 'falhou' } });
    await expect(repo.findPagamentos()).rejects.toThrow(/falhou/);
  });
});

describe('SupabaseHistoricoRepository: findById e delete', () => {
  let mockClient: any;
  let repo: SupabaseHistoricoRepository;

  beforeEach(() => {
    mockClient = { from: vi.fn() };
    repo = new SupabaseHistoricoRepository(mockClient as SupabaseClient);
  });

  it('busca um registro pelo id', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 7 }, error: null }),
    };
    mockClient.from.mockReturnValue(chain);

    expect(await repo.findById(7)).toEqual({ id: 7 });
    expect(chain.eq).toHaveBeenCalledWith('id', 7);
  });

  it('devolve null quando o registro não existe', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockClient.from.mockReturnValue(chain);

    expect(await repo.findById(7)).toBeNull();
  });

  it('apaga um registro pelo id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    mockClient.from.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq }) });

    await repo.delete(7);

    expect(eq).toHaveBeenCalledWith('id', 7);
  });

  it('lança erro quando não consegue apagar', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'falhou' } });
    mockClient.from.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq }) });

    await expect(repo.delete(7)).rejects.toThrow(/falhou/);
  });
});
