import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageQueueService } from './message-queue.service.js';
import { IWhatsAppGateway, NumeroSemWhatsAppError } from './whatsapp-gateway.interface.js';

describe('MessageQueueService with Anti-Ban (TDD)', () => {
  let mockGateway: { [K in keyof IWhatsAppGateway]: ReturnType<typeof vi.fn> };
  let queueService: MessageQueueService;

  beforeEach(() => {
    vi.useFakeTimers();

    mockGateway = {
      sendPresence: vi.fn().mockResolvedValue(true),
      sendText: vi.fn().mockResolvedValue({ id: 'ABC', jid: 'x@s.whatsapp.net' }),
      checkInstanceStatus: vi.fn().mockResolvedValue({ state: 'open' }),
      numberExists: vi.fn().mockResolvedValue(true),
      getQrCode: vi.fn(),
    };

    queueService = new MessageQueueService(mockGateway as unknown as IWhatsAppGateway, {
      minDelayMs: 2000,
      maxDelayMs: 4000,
      simulateTyping: true,
      typingDurationMs: 1000,
      disconnectedRetryMs: 5000,
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
    expect(mockGateway.sendPresence).toHaveBeenCalledWith('5511999999999', 'composing');
    expect(mockGateway.sendText).toHaveBeenCalledWith('5511999999999', 'Mensagem 1');
    expect(job1).toHaveBeenCalled();

    // The second item should NOT have run yet because of anti-ban delay (2000-4000ms)
    expect(job2).not.toHaveBeenCalled();

    // Advance time past the maximum delay (4000ms) + typing (1000ms)
    await vi.advanceTimersByTimeAsync(5500);

    expect(mockGateway.sendPresence).toHaveBeenCalledWith('5511888888888', 'composing');
    expect(mockGateway.sendText).toHaveBeenCalledWith('5511888888888', 'Mensagem 2');
    expect(job2).toHaveBeenCalled();
  });

  it('aguarda a reconexão do WhatsApp em vez de registrar falha', async () => {
    mockGateway.checkInstanceStatus.mockResolvedValue({ state: 'close' });
    const onSuccess = vi.fn();
    const onError = vi.fn();

    queueService.enqueue({ whatsapp: '5511999999999', message: 'Oi', onSuccess, onError });

    await vi.advanceTimersByTimeAsync(12000); // 2 verificações sem conexão
    expect(mockGateway.sendText).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(queueService.getTotalPending()).toBe(1);

    mockGateway.checkInstanceStatus.mockResolvedValue({ state: 'open' });
    await vi.advanceTimersByTimeAsync(6000 + 1100);

    expect(mockGateway.sendText).toHaveBeenCalledWith('5511999999999', 'Oi');
    expect(onSuccess).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('não envia para número sem WhatsApp: registra erro e segue para o próximo', async () => {
    mockGateway.numberExists.mockImplementation(async (n: string) => n !== '5511000000000');
    const onError = vi.fn();
    const onSuccess2 = vi.fn();

    queueService.enqueue({ whatsapp: '5511000000000', message: 'Msg 1', onError });
    queueService.enqueue({ whatsapp: '5511888888888', message: 'Msg 2', onSuccess: onSuccess2 });

    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(NumeroSemWhatsAppError);
    expect(mockGateway.sendPresence).not.toHaveBeenCalledWith('5511000000000', expect.anything());
    expect(mockGateway.sendText).not.toHaveBeenCalledWith('5511000000000', expect.anything());

    await vi.advanceTimersByTimeAsync(5500);
    expect(mockGateway.sendText).toHaveBeenCalledWith('5511888888888', 'Msg 2');
    expect(onSuccess2).toHaveBeenCalled();
  });

  it('registra erro de envio e continua a fila', async () => {
    mockGateway.sendText.mockRejectedValueOnce(new Error('falha de rede'));
    const onError = vi.fn();
    const onSuccess = vi.fn();

    queueService.enqueue({ whatsapp: '5511111111111', message: 'A', onError });
    queueService.enqueue({ whatsapp: '5511222222222', message: 'B', onSuccess });

    await vi.advanceTimersByTimeAsync(1100);
    expect(onError).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5500);
    expect(onSuccess).toHaveBeenCalled();
  });
});
