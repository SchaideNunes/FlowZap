import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseUserRepository } from './supabase-user.repository.js';
import { SupabaseClient } from '@supabase/supabase-js';

describe('SupabaseUserRepository (TDD)', () => {
  let mockClient: any;
  let repo: SupabaseUserRepository;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    };
    repo = new SupabaseUserRepository(mockClient as SupabaseClient);
  });

  describe('findByEmail', () => {
    it('should query the usuarios table with parameterized email', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: '1', nome: 'Dono', email: 'dono@flowzap.com', ativo: true },
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const user = await repo.findByEmail('Dono@FlowZap.com');

      expect(mockClient.from).toHaveBeenCalledWith('usuarios');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('email', 'dono@flowzap.com');
      expect(user).toEqual({ id: '1', nome: 'Dono', email: 'dono@flowzap.com', ativo: true });
    });

    it('should throw error if supabase query errors', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      await expect(repo.findByEmail('dono@flowzap.com')).rejects.toThrow(
        'Erro ao buscar usuário por email: Database connection failed'
      );
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'uuid-1', nome: 'Sócio', email: 'socio@flowzap.com' },
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const user = await repo.findById('uuid-1');

      expect(mockChain.eq).toHaveBeenCalledWith('id', 'uuid-1');
      expect(user?.id).toBe('uuid-1');
    });
  });

  describe('create', () => {
    it('should insert a user into usuarios table', async () => {
      const newUser = {
        id: 'uuid-new',
        nome: 'Novo Sócio',
        email: 'novo@flowzap.com',
        senha_hash: 'hash123',
        ativo: true,
      };

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: newUser,
          error: null,
        }),
      };
      mockClient.from.mockReturnValue(mockChain);

      const created = await repo.create({
        nome: 'Novo Sócio',
        email: 'NOVO@FLOWZAP.COM',
        senha_hash: 'hash123',
      });

      expect(mockClient.from).toHaveBeenCalledWith('usuarios');
      expect(mockChain.insert).toHaveBeenCalledWith({
        nome: 'Novo Sócio',
        email: 'novo@flowzap.com',
        senha_hash: 'hash123',
        ativo: true,
      });
      expect(created).toEqual(newUser);
    });
  });
});
