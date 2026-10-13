import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { SedeLockService } from './sede-lock.service.js';
import { SedeHeartbeatService } from './sede-heartbeat.service.js';
import { SchedulerService } from './scheduler.service.js';
import { SupabaseSedeStatusRepository } from '../repositories/supabase-sede-status.repository.js';

const ID_LOJA = '11111111-1111-4111-8111-111111111111';
const ID_OUTRA = '22222222-2222-4222-8222-222222222222';

describe('Trava da sede: só uma máquina envia cobranças', () => {
  describe('SedeLockService', () => {
    let repo: { claimSede: ReturnType<typeof vi.fn>; getStatus: ReturnType<typeof vi.fn> };
    let onChange: ReturnType<typeof vi.fn>;
    let log: ReturnType<typeof vi.fn>;
    const build = () =>
      new SedeLockService(repo as any, { id: ID_LOJA, nome: 'PC-LOJA', onChange, log });

    beforeEach(() => {
      repo = {
        claimSede: vi.fn().mockResolvedValue(true),
        getStatus: vi.fn().mockResolvedValue({ sede_id: ID_LOJA, sede_nome: 'PC-LOJA', atualizado_em: '2026-10-13T12:00:00.000Z' }),
      };
      onChange = vi.fn();
      log = vi.fn();
    });

    it('a primeira máquina a iniciar vira a sede', async () => {
      const lock = build();

      expect(await lock.acquire()).toBe(true);
      expect(repo.claimSede).toHaveBeenCalledWith(ID_LOJA, 'PC-LOJA', false);
      expect(lock.isHolder()).toBe(true);
      expect(lock.getInfo()).toMatchObject({ disponivel: true, souSede: true });
    });

    it('com outra máquina já como sede, esta fica só como painel e sabe quem é a sede', async () => {
      repo.claimSede.mockResolvedValue(false);
      repo.getStatus.mockResolvedValue({ sede_id: ID_OUTRA, sede_nome: 'NOTEBOOK-DEV', atualizado_em: '2026-10-13T11:59:00.000Z' });
      const lock = build();

      expect(await lock.acquire()).toBe(false);
      expect(lock.isHolder()).toBe(false);
      expect(lock.getInfo()).toEqual({
        disponivel: true,
        souSede: false,
        sedeNome: 'NOTEBOOK-DEV',
        sedeVistaEm: '2026-10-13T11:59:00.000Z',
      });
    });

    it('antes de conferir a trava, a máquina ainda não envia nada', () => {
      expect(build().isHolder()).toBe(false);
    });

    it('sem a trava no banco (migração pendente), funciona como antes e avisa uma vez', async () => {
      repo.claimSede.mockRejectedValue(new Error('column "sede_id" does not exist'));
      const lock = build();

      expect(await lock.acquire()).toBe(true);
      expect(await lock.refresh()).toBe(true);
      expect(lock.getInfo()).toMatchObject({ disponivel: false, souSede: true });
      expect(log).toHaveBeenCalledTimes(1);
    });

    it('a sede que perde a trava para outra máquina para de enviar e é avisada', async () => {
      const lock = build();
      await lock.acquire();
      onChange.mockClear();

      repo.claimSede.mockResolvedValue(false);
      repo.getStatus.mockResolvedValue({ sede_id: ID_OUTRA, sede_nome: 'PC-NOVO', atualizado_em: '2026-10-13T12:05:00.000Z' });

      expect(await lock.refresh()).toBe(false);
      expect(lock.isHolder()).toBe(false);
      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('não avisa de novo quando nada mudou', async () => {
      const lock = build();
      await lock.acquire();
      onChange.mockClear();

      await lock.refresh();
      await lock.refresh();

      expect(onChange).not.toHaveBeenCalled();
    });

    it('"usar este computador como sede" toma a trava mesmo com outra máquina ativa', async () => {
      repo.claimSede.mockImplementation(async (_id, _nome, force) => force === true);
      repo.getStatus.mockResolvedValue({ sede_id: ID_OUTRA, sede_nome: 'PC-ANTIGO', atualizado_em: '2026-10-13T12:00:00.000Z' });
      const lock = build();
      await lock.acquire();
      expect(lock.isHolder()).toBe(false);

      expect(await lock.takeOver()).toBe(true);
      expect(repo.claimSede).toHaveBeenLastCalledWith(ID_LOJA, 'PC-LOJA', true);
      expect(lock.isHolder()).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith(true);
    });

    it('uma falha passageira do banco não tira a trava de quem já é a sede', async () => {
      const lock = build();
      await lock.acquire();
      repo.claimSede.mockRejectedValue(new Error('fetch failed'));

      expect(await lock.refresh()).toBe(true);
    });
  });

  describe('quem não é a sede fica quieto', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('não envia sinal de vida (não sobrescreve o estado da sede de verdade)', async () => {
      vi.useFakeTimers();
      const repo = { saveHeartbeat: vi.fn().mockResolvedValue(undefined) };
      const lock = { refresh: vi.fn().mockResolvedValue(false) };
      const service = new SedeHeartbeatService(
        repo as any,
        { checkInstanceStatus: vi.fn().mockResolvedValue({ state: 'close' }) } as any,
        { intervalMs: 60000, log: () => {}, lock: lock as any }
      );

      service.start();
      await vi.advanceTimersByTimeAsync(60000);
      service.stop();

      expect(lock.refresh).toHaveBeenCalledTimes(2);
      expect(repo.saveHeartbeat).not.toHaveBeenCalled();
    });

    it('a sede continua enviando o sinal de vida', async () => {
      vi.useFakeTimers();
      const repo = { saveHeartbeat: vi.fn().mockResolvedValue(undefined) };
      const service = new SedeHeartbeatService(
        repo as any,
        { checkInstanceStatus: vi.fn().mockResolvedValue({ state: 'open' }) } as any,
        { intervalMs: 60000, log: () => {}, lock: { refresh: vi.fn().mockResolvedValue(true) } as any }
      );

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      service.stop();

      expect(repo.saveHeartbeat).toHaveBeenCalledTimes(1);
    });

    it('não roda a rotina diária nem a recuperação, e não marca o dia como feito', async () => {
      const reminder = { dispatchReminders: vi.fn().mockResolvedValue({ dispatchedCount: 1, items: [] }) };
      const sedeRepo = {
        getStatus: vi.fn().mockResolvedValue({ ultima_rotina_data: '2026-10-08' }),
        markRoutineRun: vi.fn().mockResolvedValue(undefined),
      };
      const scheduler = new SchedulerService(reminder as any, '0 9 * * *', sedeRepo as any, undefined, {
        isHolder: () => false,
      } as any);

      expect(await scheduler.runScheduledRoutine()).toBe(false);
      expect(await scheduler.runCatchUpIfNeeded(new Date(2026, 9, 9, 10, 0))).toBe(false);
      expect(reminder.dispatchReminders).not.toHaveBeenCalled();
      expect(sedeRepo.markRoutineRun).not.toHaveBeenCalled();
    });

    it('a sede roda a rotina normalmente', async () => {
      const reminder = { dispatchReminders: vi.fn().mockResolvedValue({ dispatchedCount: 1, items: [] }) };
      const sedeRepo = { getStatus: vi.fn(), markRoutineRun: vi.fn().mockResolvedValue(undefined) };
      const scheduler = new SchedulerService(reminder as any, '0 9 * * *', sedeRepo as any, undefined, {
        isHolder: () => true,
      } as any);

      expect(await scheduler.runScheduledRoutine()).toBe(true);
      expect(reminder.dispatchReminders).toHaveBeenCalledTimes(1);
    });
  });

  describe('SupabaseSedeStatusRepository.claimSede', () => {
    const build = (updated: unknown[] | null, error: unknown = null) => {
      const upsert = vi.fn().mockResolvedValue({ error: null });
      const select = vi.fn().mockResolvedValue({ data: updated, error });
      const or = vi.fn().mockReturnValue({ select });
      const eq = vi.fn().mockReturnValue({ or, select });
      const update = vi.fn().mockReturnValue({ eq });
      const client = { from: vi.fn().mockReturnValue({ upsert, update }) };
      return { repo: new SupabaseSedeStatusRepository(client as unknown as SupabaseClient), upsert, update, eq, or, select };
    };

    it('só toma a trava se ela estiver livre ou já for desta máquina', async () => {
      const { repo, upsert, update, or } = build([{ id: 1 }]);

      expect(await repo.claimSede(ID_LOJA, 'PC-LOJA', false)).toBe(true);
      expect(upsert).toHaveBeenCalledWith({ id: 1 }, { onConflict: 'id', ignoreDuplicates: true });
      expect(update).toHaveBeenCalledWith({ sede_id: ID_LOJA, sede_nome: 'PC-LOJA' });
      expect(or).toHaveBeenCalledWith(`sede_id.is.null,sede_id.eq.${ID_LOJA}`);
    });

    it('devolve false quando outra máquina é a sede', async () => {
      const { repo } = build([]);

      expect(await repo.claimSede(ID_LOJA, 'PC-LOJA', false)).toBe(false);
    });

    it('ao forçar, toma a trava sem condição', async () => {
      const { repo, or } = build([{ id: 1 }]);

      expect(await repo.claimSede(ID_LOJA, 'PC-LOJA', true)).toBe(true);
      expect(or).not.toHaveBeenCalled();
    });

    it('recusa identificador fora do formato esperado (nada de texto livre no filtro)', async () => {
      const { repo, update } = build([{ id: 1 }]);

      await expect(repo.claimSede('x,sede_id.neq.y', 'PC', false)).rejects.toThrow(/identificador/i);
      expect(update).not.toHaveBeenCalled();
    });

    it('lança erro quando o banco ainda não tem a coluna da trava', async () => {
      const { repo } = build(null, { message: 'column "sede_id" does not exist' });

      await expect(repo.claimSede(ID_LOJA, 'PC-LOJA', false)).rejects.toThrow(/does not exist/);
    });
  });
});
