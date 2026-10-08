import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchedulerService } from './scheduler.service.js';

describe('SchedulerService.runCatchUpIfNeeded', () => {
  let reminderService: { dispatchReminders: ReturnType<typeof vi.fn> };
  let repo: { getStatus: ReturnType<typeof vi.fn>; markRoutineRun: ReturnType<typeof vi.fn> };

  const at = (hour: number, minute = 0) => new Date(2026, 9, 9, hour, minute); // 09/10/2026 local

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reminderService = { dispatchReminders: vi.fn().mockResolvedValue({ dispatchedCount: 2, items: [] }) };
    repo = {
      getStatus: vi.fn().mockResolvedValue({ estado_whatsapp: 'open', atualizado_em: null, ultima_rotina_data: '2026-10-08' }),
      markRoutineRun: vi.fn().mockResolvedValue(undefined),
    };
  });

  const build = (cron = '0 9 * * *', withRepo = true) =>
    new SchedulerService(reminderService as any, cron, withRepo ? (repo as any) : undefined);

  it('roda a rotina do dia quando o computador ligou depois do horário e ela ainda não rodou', async () => {
    const ran = await build().runCatchUpIfNeeded(at(10, 30));

    expect(ran).toBe(true);
    expect(reminderService.dispatchReminders).toHaveBeenCalledTimes(1);
    expect(repo.markRoutineRun).toHaveBeenCalledWith('2026-10-09');
  });

  it('não roda antes do horário agendado: o cron cuida disso', async () => {
    expect(await build().runCatchUpIfNeeded(at(8, 59))).toBe(false);
    expect(reminderService.dispatchReminders).not.toHaveBeenCalled();
  });

  it('não repete quando a rotina de hoje já rodou', async () => {
    repo.getStatus.mockResolvedValue({ estado_whatsapp: 'open', atualizado_em: null, ultima_rotina_data: '2026-10-09' });

    expect(await build().runCatchUpIfNeeded(at(15))).toBe(false);
    expect(reminderService.dispatchReminders).not.toHaveBeenCalled();
  });

  it('não faz recuperação quando o agendamento não é um horário fixo diário', async () => {
    expect(await build('*/5 * * * *').runCatchUpIfNeeded(at(15))).toBe(false);
    expect(reminderService.dispatchReminders).not.toHaveBeenCalled();
  });

  it('roda mesmo sem conseguir ler o registro (tabela ainda não criada): o anti-duplicidade protege', async () => {
    repo.getStatus.mockRejectedValue(new Error('relation does not exist'));

    expect(await build().runCatchUpIfNeeded(at(10))).toBe(true);
    expect(reminderService.dispatchReminders).toHaveBeenCalledTimes(1);
  });

  it('não falha quando não consegue registrar que a rotina rodou', async () => {
    repo.markRoutineRun.mockRejectedValue(new Error('x'));

    await expect(build().runCatchUpIfNeeded(at(10))).resolves.toBe(true);
  });

  it('funciona sem repositório configurado', async () => {
    expect(await build('0 9 * * *', false).runCatchUpIfNeeded(at(10))).toBe(true);
  });

  it('propaga erro do disparo sem marcar a rotina como feita', async () => {
    reminderService.dispatchReminders.mockRejectedValue(new Error('banco fora'));

    await expect(build().runCatchUpIfNeeded(at(10))).rejects.toThrow(/banco fora/);
    expect(repo.markRoutineRun).not.toHaveBeenCalled();
  });
});
