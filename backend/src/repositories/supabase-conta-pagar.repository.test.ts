import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseContaPagarRepository } from './supabase-conta-pagar.repository.js';
import { SupabaseClient } from '@supabase/supabase-js';

describe('SupabaseContaPagarRepository (TDD)', () => {
  let mockClient: any;
  let repo: SupabaseContaPagarRepository;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    };
    repo = new SupabaseContaPagarRepository(mockClient as SupabaseClient);
  });

  describe('findAll', () => {
    it('should query contas_a_pagar ordered by id', async () => {
      const mockData = [
        { id: 1, nome_credor: 'CRISTE (PARCELADO)', valor: 7500, pago: false },
        { id: 2, nome_credor: 'JOSA', valor: 1000, pago: false },
      ];

      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const result = await repo.findAll();

      expect(mockClient.from).toHaveBeenCalledWith('contas_a_pagar');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(result).toHaveLength(2);
      expect(result[0].nome_credor).toBe('CRISTE (PARCELADO)');
    });

    it('should fallback gracefully to in-memory items if table does not exist', async () => {
      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST205', message: 'relation "public.contas_a_pagar" does not exist' },
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const result = await repo.findAll();

      // Should return seed items (CRISTE and JOSA)
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.find((i) => i.nome_credor.includes('CRISTE'))).toBeDefined();
      expect(result.find((i) => i.nome_credor === 'JOSA')).toBeDefined();
    });
  });

  describe('create', () => {
    it('should insert a record into contas_a_pagar', async () => {
      const itemToCreate = {
        nome_credor: 'FORNECEDOR PEÇAS',
        valor: 1500,
        pago: false,
      };

      const created = {
        id: 3,
        ...itemToCreate,
        criado_em: '2026-10-02T19:00:00Z',
      };

      const mockChain: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: created,
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const result = await repo.create(itemToCreate);

      expect(mockClient.from).toHaveBeenCalledWith('contas_a_pagar');
      expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        nome_credor: 'FORNECEDOR PEÇAS',
        valor: 1500,
      }));
      expect(result.id).toBe(3);
    });
  });

  describe('getTotalPendente', () => {
    it('should sum all unpaid items', async () => {
      const mockData = [
        { id: 1, nome_credor: 'CRISTE (PARCELADO)', valor: 7500, pago: false },
        { id: 2, nome_credor: 'JOSA', valor: 1000, pago: false },
        { id: 3, nome_credor: 'OUTRO PAGO', valor: 500, pago: true },
      ];

      const mockChain: any = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockData,
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const total = await repo.getTotalPendente();
      expect(total).toBe(8500);
    });
  });
});
