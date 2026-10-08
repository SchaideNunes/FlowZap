import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseSedeStatusRepository } from './supabase-sede-status.repository.js';

describe('SupabaseSedeStatusRepository', () => {
  let mockClient: any;
  let repo: SupabaseSedeStatusRepository;

  beforeEach(() => {
    mockClient = { from: vi.fn() };
    repo = new SupabaseSedeStatusRepository(mockClient as SupabaseClient);
  });

  describe('getStatus', () => {
    it('lê a linha única de sede_status', async () => {
      const row = { estado_whatsapp: 'open', atualizado_em: '2026-10-09T12:00:00Z', ultima_rotina_data: '2026-10-09' };
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
      };
      mockClient.from.mockReturnValue(chain);

      const result = await repo.getStatus();

      expect(mockClient.from).toHaveBeenCalledWith('sede_status');
      expect(chain.eq).toHaveBeenCalledWith('id', 1);
      expect(result).toEqual(row);
    });

    it('devolve null quando ainda não há registro', async () => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockClient.from.mockReturnValue(chain);

      expect(await repo.getStatus()).toBeNull();
    });

    it('lança erro quando a consulta falha (ex.: tabela inexistente)', async () => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'relation does not exist' } }),
      };
      mockClient.from.mockReturnValue(chain);

      await expect(repo.getStatus()).rejects.toThrow(/does not exist/);
    });
  });

  describe('saveHeartbeat', () => {
    it('grava estado e horário na linha única sem tocar na data da rotina', async () => {
      const upsert = vi.fn().mockResolvedValue({ error: null });
      mockClient.from.mockReturnValue({ upsert });
      const at = new Date('2026-10-09T12:00:00Z');

      await repo.saveHeartbeat('open', at);

      expect(mockClient.from).toHaveBeenCalledWith('sede_status');
      expect(upsert).toHaveBeenCalledWith(
        { id: 1, estado_whatsapp: 'open', atualizado_em: '2026-10-09T12:00:00.000Z' },
        { onConflict: 'id' }
      );
    });

    it('lança erro quando a gravação falha', async () => {
      mockClient.from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: { message: 'falhou' } }) });
      await expect(repo.saveHeartbeat('close', new Date())).rejects.toThrow(/falhou/);
    });
  });

  describe('markRoutineRun', () => {
    it('grava somente a data da última rotina diária', async () => {
      const upsert = vi.fn().mockResolvedValue({ error: null });
      mockClient.from.mockReturnValue({ upsert });

      await repo.markRoutineRun('2026-10-09');

      expect(upsert).toHaveBeenCalledWith({ id: 1, ultima_rotina_data: '2026-10-09' }, { onConflict: 'id' });
    });
  });
});
