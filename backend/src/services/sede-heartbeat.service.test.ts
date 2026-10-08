import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SedeHeartbeatService } from './sede-heartbeat.service.js';

describe('SedeHeartbeatService', () => {
  let gateway: { checkInstanceStatus: ReturnType<typeof vi.fn> };
  let repo: { saveHeartbeat: ReturnType<typeof vi.fn> };
  let service: SedeHeartbeatService;
  let log: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
    gateway = { checkInstanceStatus: vi.fn().mockResolvedValue({ state: 'open' }) };
    repo = { saveHeartbeat: vi.fn().mockResolvedValue(undefined) };
    log = vi.fn();
    service = new SedeHeartbeatService(repo as any, gateway as any, { intervalMs: 60000, log });
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it('envia um sinal de vida imediatamente ao iniciar, com o estado atual do WhatsApp', async () => {
    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(repo.saveHeartbeat).toHaveBeenCalledTimes(1);
    expect(repo.saveHeartbeat).toHaveBeenCalledWith('open', new Date('2026-10-09T12:00:00Z'));
  });

  it('repete a cada intervalo', async () => {
    gateway.checkInstanceStatus.mockResolvedValueOnce({ state: 'open' }).mockResolvedValue({ state: 'close' });
    service.start();
    await vi.advanceTimersByTimeAsync(60000);

    expect(repo.saveHeartbeat).toHaveBeenCalledTimes(2);
    expect(repo.saveHeartbeat).toHaveBeenLastCalledWith('close', expect.any(Date));
  });

  it('não derruba o processo quando o banco falha e avisa só na primeira falha', async () => {
    repo.saveHeartbeat.mockRejectedValue(new Error('tabela inexistente'));
    service.start();
    await vi.advanceTimersByTimeAsync(120000);

    expect(repo.saveHeartbeat).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('avisa de novo se voltar a falhar depois de se recuperar', async () => {
    repo.saveHeartbeat
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('y'));
    service.start();
    await vi.advanceTimersByTimeAsync(120000);

    expect(log).toHaveBeenCalledTimes(2);
  });

  it('stop() interrompe os envios e start() é idempotente', async () => {
    service.start();
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(repo.saveHeartbeat).toHaveBeenCalledTimes(1);

    service.stop();
    await vi.advanceTimersByTimeAsync(300000);
    expect(repo.saveHeartbeat).toHaveBeenCalledTimes(1);
  });
});
