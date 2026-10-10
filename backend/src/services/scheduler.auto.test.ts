import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchedulerService } from './scheduler.service.js';

describe('SchedulerService: envio automático ligado/desligado', () => {
  let reminderService: { dispatchReminders: ReturnType<typeof vi.fn> };
  let repo: { getStatus: ReturnType<typeof vi.fn>; markRoutineRun: ReturnType<typeof vi.fn> };
  let config: { get: ReturnType<typeof vi.fn> };

  const at = (hour: number) => new Date(2026, 9, 9, hour, 0);

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    reminderService = { dispatchReminders: vi.fn().mockResolvedValue({ dispatchedCount: 1, items: [] }) };
    repo = {
      getStatus: vi.fn().mockResolvedValue({ estado_whatsapp: 'open', atualizado_em: null, ultima_rotina_data: '2026-10-08' }),
      markRoutineRun: vi.fn().mockResolvedValue(undefined),
    };
    config = { get: vi.fn().mockResolvedValue({ envio_automatico: true, mensagens: {} }) };
  });

  const build = () => new SchedulerService(reminderService as any, '0 9 * * *', repo as any, config as any);

  it('com o envio automático desligado, a recuperação ao ligar o computador não envia nada', async () => {
    config.get.mockResolvedValue({ envio_automatico: false, mensagens: {} });

    expect(await build().runCatchUpIfNeeded(at(10))).toBe(false);
    expect(reminderService.dispatchReminders).not.toHaveBeenCalled();
    expect(repo.markRoutineRun).not.toHaveBeenCalled();
  });

  it('com o envio automático desligado, a rotina do horário agendado não envia nada', async () => {
    config.get.mockResolvedValue({ envio_automatico: false, mensagens: {} });

    expect(await build().runScheduledRoutine()).toBe(false);
    expect(reminderService.dispatchReminders).not.toHaveBeenCalled();
  });

  it('com o envio automático ligado, a rotina agendada envia e registra o dia', async () => {
    expect(await build().runScheduledRoutine()).toBe(true);
    expect(reminderService.dispatchReminders).toHaveBeenCalledTimes(1);
    expect(repo.markRoutineRun).toHaveBeenCalledTimes(1);
  });

  it('com o envio automático ligado, a recuperação continua funcionando', async () => {
    expect(await build().runCatchUpIfNeeded(at(10))).toBe(true);
    expect(reminderService.dispatchReminders).toHaveBeenCalledTimes(1);
  });
});
