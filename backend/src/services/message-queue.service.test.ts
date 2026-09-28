import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageQueueService } from './message-queue.service.js';
import { EvolutionService } from './evolution.service.js';

describe('MessageQueueService with Anti-Ban (TDD)', () => {
  let mockEvolution: EvolutionService;
  let queueService: MessageQueueService;

  beforeEach(() => {
    vi.useFakeTimers();

    mockEvolution = {
      sendPresence: vi.fn().mockResolvedValue(true),
      sendText: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
      checkInstanceStatus: vi.fn(),
      getQrCode: vi.fn(),
    } as unknown as EvolutionService;

    queueService = new MessageQueueService(mockEvolution, {
      minDelayMs: 2000,
      maxDelayMs: 4000,
      simulateTyping: true,
      typingDurationMs: 1000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should process messages sequentially with typing presence and anti-ban delay', async () => {
    const executedTimes: number[] = [];

    const job1 = vi.fn().mockImplementation(async () => {
      executedTimes.push(Date.now());
    });
    const job2 = vi.fn().mockImplementation(async () => {
      executedTimes.push(Date.now());
    });

    queueService.enqueue({
      whatsapp: '5511999999999',
      message: 'Mensagem 1',
      onSuccess: job1,
    });

    queueService.enqueue({
      whatsapp: '5511888888888',
      message: 'Mensagem 2',
      onSuccess: job2,
    });

    // Initial state: Queue is processing first item, 1 waiting
    expect(queueService.getTotalPending()).toBe(2);
    expect(queueService.getQueueLength()).toBe(1);

    // Advance time for typing simulation (1000ms)
    await vi.advanceTimersByTimeAsync(1100);
    expect(mockEvolution.sendPresence).toHaveBeenCalledWith('5511999999999', 'composing');
    expect(mockEvolution.sendText).toHaveBeenCalledWith('5511999999999', 'Mensagem 1');
    expect(job1).toHaveBeenCalled();

    // The second item should NOT have run yet because of anti-ban delay (2000-4000ms)
    expect(job2).not.toHaveBeenCalled();

    // Advance time past the maximum delay (4000ms) + typing (1000ms)
    await vi.advanceTimersByTimeAsync(5500);

    expect(mockEvolution.sendPresence).toHaveBeenCalledWith('5511888888888', 'composing');
    expect(mockEvolution.sendText).toHaveBeenCalledWith('5511888888888', 'Mensagem 2');
    expect(job2).toHaveBeenCalled();
  });
});
