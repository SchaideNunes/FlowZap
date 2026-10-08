import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BaileysService,
  WASocketLike,
  ConnectionUpdate,
  normalizeWhatsAppNumber,
} from './baileys.service.js';
import { NumeroSemWhatsAppError } from './whatsapp-gateway.interface.js';

type Listener = (update: ConnectionUpdate) => void;

interface FakeSocket extends WASocketLike {
  emit: (update: ConnectionUpdate) => void;
  sendMessage: ReturnType<typeof vi.fn>;
  sendPresenceUpdate: ReturnType<typeof vi.fn>;
  presenceSubscribe: ReturnType<typeof vi.fn>;
  onWhatsApp: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

function createFakeSocket(): FakeSocket {
  let listener: Listener | null = null;
  return {
    ev: {
      on: (_event: 'connection.update', cb: Listener) => {
        listener = cb;
      },
    },
    emit: (update) => listener?.(update),
    sendMessage: vi.fn().mockResolvedValue({ key: { id: 'MSG123' } }),
    sendPresenceUpdate: vi.fn().mockResolvedValue(undefined),
    presenceSubscribe: vi.fn().mockResolvedValue(undefined),
    onWhatsApp: vi.fn().mockResolvedValue([{ jid: '5511999999999@s.whatsapp.net', exists: true }]),
    end: vi.fn(),
  };
}

const closeWith = (statusCode: number): ConnectionUpdate => ({
  connection: 'close',
  lastDisconnect: { error: { output: { statusCode } } },
});

describe('normalizeWhatsAppNumber', () => {
  it('mantém apenas dígitos e preserva o DDI 55', () => {
    expect(normalizeWhatsAppNumber('+55 (11) 99999-9999')).toBe('5511999999999');
  });

  it('acrescenta o DDI 55 quando o número vem só com DDD', () => {
    expect(normalizeWhatsAppNumber('(11) 99999-9999')).toBe('5511999999999');
    expect(normalizeWhatsAppNumber('1133334444')).toBe('551133334444');
  });
});

describe('BaileysService', () => {
  let sockets: FakeSocket[];
  let createSocket: ReturnType<typeof vi.fn>;
  let clearAuth: ReturnType<typeof vi.fn>;
  let hasSession: ReturnType<typeof vi.fn>;
  let service: BaileysService;

  const build = (overrides: Partial<ConstructorParameters<typeof BaileysService>[0]> = {}) =>
    new BaileysService({
      createSocket,
      clearAuth,
      hasSession,
      qrToDataUrl: async (qr: string) => `data:image/png;base64,QR(${qr})`,
      random: () => 0.5, // jitter neutro (fator 1.0)
      reconnectBaseMs: 2000,
      reconnectMaxMs: 60000,
      qrWaitMs: 1000,
      log: () => {},
      ...overrides,
    });

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    createSocket = vi.fn().mockImplementation(async () => {
      const s = createFakeSocket();
      sockets.push(s);
      return s;
    });
    clearAuth = vi.fn();
    hasSession = vi.fn().mockReturnValue(true);
    service = build();
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  describe('estado da conexão', () => {
    it('informa "close" enquanto nunca foi iniciado', async () => {
      expect(await service.checkInstanceStatus()).toEqual({ state: 'close' });
      expect(createSocket).not.toHaveBeenCalled();
    });

    it('fica "connecting" ao iniciar e "open" quando o WhatsApp confirma', async () => {
      await service.start();
      expect((await service.checkInstanceStatus()).state).toBe('connecting');

      sockets[0].emit({ connection: 'open' });
      expect((await service.checkInstanceStatus()).state).toBe('open');
    });

    it('start() é idempotente', async () => {
      await service.start();
      await service.start();
      expect(createSocket).toHaveBeenCalledTimes(1);
    });

    it('ignora eventos de sockets antigos', async () => {
      await service.start();
      sockets[0].emit(closeWith(428));
      await vi.advanceTimersByTimeAsync(2000);
      expect(sockets).toHaveLength(2);

      sockets[0].emit({ connection: 'open' }); // socket velho
      expect((await service.checkInstanceStatus()).state).toBe('connecting');
    });
  });

  describe('QR Code', () => {
    it('devolve o QR em data URL quando o WhatsApp o gera', async () => {
      await service.start();
      sockets[0].emit({ qr: 'RAW-QR-1' });

      const result = await service.getQrCode();

      expect(result.state).toBe('connecting');
      expect(result.qrcode).toBe('data:image/png;base64,QR(RAW-QR-1)');
    });

    it('inicia a conexão sozinho e aguarda o QR chegar', async () => {
      const pending = service.getQrCode();
      await vi.advanceTimersByTimeAsync(0);
      expect(createSocket).toHaveBeenCalledTimes(1);

      sockets[0].emit({ qr: 'QR-TARDIO' });
      const result = await pending;

      expect(result.qrcode).toBe('data:image/png;base64,QR(QR-TARDIO)');
    });

    it('devolve qrcode nulo quando o QR não chega dentro do prazo', async () => {
      const pending = service.getQrCode();
      await vi.advanceTimersByTimeAsync(1500);
      const result = await pending;

      expect(result.qrcode).toBeNull();
      expect(result.state).toBe('connecting');
    });

    it('não cria nova conexão nem QR quando já está conectado', async () => {
      await service.start();
      sockets[0].emit({ connection: 'open' });

      const result = await service.getQrCode();

      expect(result).toEqual({ state: 'open' });
      expect(createSocket).toHaveBeenCalledTimes(1);
    });

    it('descarta o QR depois de conectar', async () => {
      await service.start();
      sockets[0].emit({ qr: 'QR' });
      sockets[0].emit({ connection: 'open' });
      sockets[0].emit(closeWith(428));
      await vi.advanceTimersByTimeAsync(2000);

      const pending = service.getQrCode();
      await vi.advanceTimersByTimeAsync(1500);
      expect((await pending).qrcode).toBeNull();
    });
  });

  describe('reconexão', () => {
    it('reconecta com espera crescente após queda de rede', async () => {
      await service.start();
      sockets[0].emit({ connection: 'open' });

      sockets[0].emit(closeWith(428));
      expect((await service.checkInstanceStatus()).state).toBe('close');
      await vi.advanceTimersByTimeAsync(1999);
      expect(sockets).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(2);
      expect(sockets).toHaveLength(2); // 1ª tentativa após 2s

      sockets[1].emit(closeWith(428));
      await vi.advanceTimersByTimeAsync(3999);
      expect(sockets).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(2);
      expect(sockets).toHaveLength(3); // 2ª tentativa após 4s
    });

    it('limita a espera ao máximo configurado', async () => {
      service.stop();
      service = build({ reconnectBaseMs: 1000, reconnectMaxMs: 3000 });
      await service.start();

      for (let i = 0; i < 4; i++) {
        sockets[i].emit(closeWith(428));
        await vi.advanceTimersByTimeAsync(3001);
      }
      expect(sockets).toHaveLength(5); // 1 + 4 reconexões, nenhuma espera passou de 3s
    });

    it('zera a espera depois de reconectar com sucesso', async () => {
      await service.start();
      sockets[0].emit(closeWith(428));
      await vi.advanceTimersByTimeAsync(2001);
      sockets[1].emit(closeWith(428));
      await vi.advanceTimersByTimeAsync(4001);
      sockets[2].emit({ connection: 'open' });

      sockets[2].emit(closeWith(428));
      await vi.advanceTimersByTimeAsync(2001);
      expect(sockets).toHaveLength(4); // voltou a esperar 2s
    });

    it('reconecta na hora após restartRequired (normal depois de ler o QR)', async () => {
      await service.start();
      sockets[0].emit(closeWith(515));
      await vi.advanceTimersByTimeAsync(0);
      expect(sockets).toHaveLength(2);
    });

    it('apaga a sessão e não reconecta quando o aparelho é desconectado (loggedOut)', async () => {
      await service.start();
      sockets[0].emit(closeWith(401));
      await vi.advanceTimersByTimeAsync(120000);

      expect(clearAuth).toHaveBeenCalledTimes(1);
      expect(sockets).toHaveLength(1);
      expect((await service.checkInstanceStatus()).state).toBe('close');
    });

    it('não briga pela sessão quando ela é aberta em outro lugar (connectionReplaced)', async () => {
      await service.start();
      sockets[0].emit(closeWith(440));
      await vi.advanceTimersByTimeAsync(120000);

      expect(clearAuth).not.toHaveBeenCalled();
      expect(sockets).toHaveLength(1);
    });

    it('não insiste em reconectar enquanto o número ainda não foi pareado', async () => {
      hasSession.mockReturnValue(false);
      await service.start();
      sockets[0].emit(closeWith(408)); // QR expirou sem ninguém ler
      await vi.advanceTimersByTimeAsync(120000);

      expect(sockets).toHaveLength(1);
      expect((await service.checkInstanceStatus()).state).toBe('close');
    });

    it('stop() encerra o socket ativo e não reconecta', async () => {
      await service.start();
      sockets[0].emit({ connection: 'open' });
      service.stop();
      sockets[0].emit(closeWith(428)); // evento tardio do socket encerrado
      await vi.advanceTimersByTimeAsync(120000);

      expect(sockets[0].end).toHaveBeenCalled();
      expect(sockets).toHaveLength(1);
      expect((await service.checkInstanceStatus()).state).toBe('close');
    });

    it('stop() cancela uma reconexão que já estava agendada', async () => {
      await service.start();
      sockets[0].emit(closeWith(428));
      service.stop();
      await vi.advanceTimersByTimeAsync(120000);

      expect(sockets).toHaveLength(1);
    });
  });

  describe('envio', () => {
    beforeEach(async () => {
      await service.start();
      sockets[0].emit({ connection: 'open' });
    });

    it('resolve o JID pelo WhatsApp e envia o texto', async () => {
      const result = await service.sendText('+55 (11) 99999-9999', 'Olá!');

      expect(sockets[0].onWhatsApp).toHaveBeenCalledWith('5511999999999');
      expect(sockets[0].sendMessage).toHaveBeenCalledWith('5511999999999@s.whatsapp.net', { text: 'Olá!' });
      expect(result).toEqual({ id: 'MSG123', jid: '5511999999999@s.whatsapp.net' });
    });

    it('usa o JID devolvido pelo WhatsApp (números antigos sem o 9º dígito)', async () => {
      sockets[0].onWhatsApp.mockResolvedValue([{ jid: '551188887777@s.whatsapp.net', exists: true }]);

      await service.sendText('5511988887777', 'Oi');

      expect(sockets[0].sendMessage).toHaveBeenCalledWith('551188887777@s.whatsapp.net', { text: 'Oi' });
    });

    it('lança NumeroSemWhatsAppError e não envia quando o número não existe', async () => {
      sockets[0].onWhatsApp.mockResolvedValue([{ jid: '5511000000000@s.whatsapp.net', exists: false }]);

      await expect(service.sendText('5511000000000', 'Oi')).rejects.toBeInstanceOf(NumeroSemWhatsAppError);
      expect(sockets[0].sendMessage).not.toHaveBeenCalled();
    });

    it('trata resposta vazia do WhatsApp como número inexistente', async () => {
      sockets[0].onWhatsApp.mockResolvedValue([]);
      expect(await service.numberExists('5511000000000')).toBe(false);
    });

    it('numberExists consulta o WhatsApp uma única vez por número (cache)', async () => {
      expect(await service.numberExists('5511999999999')).toBe(true);
      expect(await service.numberExists('+55 (11) 99999-9999')).toBe(true);
      await service.sendText('5511999999999', 'Oi');

      expect(sockets[0].onWhatsApp).toHaveBeenCalledTimes(1);
    });

    it('recusa enviar quando está desconectado', async () => {
      sockets[0].emit(closeWith(428));

      await expect(service.sendText('5511999999999', 'Oi')).rejects.toThrow(/desconectado/i);
      expect(sockets[0].sendMessage).not.toHaveBeenCalled();
    });

    it('envia "digitando" depois de assinar a presença do contato', async () => {
      const ok = await service.sendPresence('5511999999999', 'composing');

      expect(ok).toBe(true);
      expect(sockets[0].presenceSubscribe).toHaveBeenCalledWith('5511999999999@s.whatsapp.net');
      expect(sockets[0].sendPresenceUpdate).toHaveBeenCalledWith('composing', '5511999999999@s.whatsapp.net');
    });

    it('falha de presença não lança erro', async () => {
      sockets[0].sendPresenceUpdate.mockRejectedValue(new Error('boom'));
      expect(await service.sendPresence('5511999999999', 'composing')).toBe(false);
    });

    it('presença devolve false quando está desconectado', async () => {
      sockets[0].emit(closeWith(428));
      expect(await service.sendPresence('5511999999999', 'composing')).toBe(false);
    });
  });
});
