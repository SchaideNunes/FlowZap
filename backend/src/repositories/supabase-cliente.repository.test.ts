import { describe, it, expect, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClienteRepository } from './supabase-cliente.repository.js';

describe('SupabaseClienteRepository.findAll', () => {
  it('devolve a data de cadastro (usada no resumo mensal) e a contagem de vendas ativas', async () => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            nome: 'Maria',
            whatsapp: '5511999999999',
            ativo: true,
            observacoes: null,
            criado_em: '2026-10-02T14:00:00.000Z',
            vendas: [{ id: 1, ativo: true }, { id: 2, ativo: false }],
          },
        ],
        error: null,
      }),
    };
    const repo = new SupabaseClienteRepository({ from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient);

    const [cliente] = await repo.findAll();

    expect(cliente.criado_em).toBe('2026-10-02T14:00:00.000Z');
    expect(cliente.vendas_ativas_count).toBe(1);
  });
});
