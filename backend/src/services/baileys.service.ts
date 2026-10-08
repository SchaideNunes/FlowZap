import QRCode from 'qrcode';
import {
  IWhatsAppGateway,
  ConnectionStatus,
  QrCodeResult,
  SendTextResult,
  WhatsAppConnectionState,
  WhatsAppPresence,
  NumeroSemWhatsAppError,
} from './whatsapp-gateway.interface.js';

// Códigos de desconexão do WhatsApp (mesmos valores de DisconnectReason do Baileys)
const STATUS_LOGGED_OUT = 401;
const STATUS_CONNECTION_REPLACED = 440;
const STATUS_RESTART_REQUIRED = 515;

const JID_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface ConnectionUpdate {
  connection?: 'open' | 'connecting' | 'close';
  qr?: string;
  lastDisconnect?: { error?: unknown };
}

/**
 * Parte do socket do Baileys que o serviço usa. Permite testar sem abrir conexão real.
 */
export interface WASocketLike {
  ev: {
    on(event: 'connection.update', listener: (update: ConnectionUpdate) => void): void;
  };
  sendMessage(jid: string, content: { text: string }): Promise<unknown>;
  sendPresenceUpdate(type: WhatsAppPresence | 'paused' | 'unavailable', toJid?: string): Promise<void>;
  presenceSubscribe(toJid: string): Promise<void>;
  onWhatsApp(...phoneNumbers: string[]): Promise<Array<{ jid: string; exists: boolean }> | undefined>;
  end(error?: Error): void;
}

export interface BaileysServiceConfig {
  /** Cria um socket novo (a sessão salva em disco é carregada aqui). */
  createSocket: () => Promise<WASocketLike>;
  /** Apaga a sessão salva (usado quando o aparelho é desconectado pelo celular). */
  clearAuth: () => void;
  /** Indica se já existe um número pareado com sessão salva. */
  hasSession: () => boolean;
  qrToDataUrl?: (qr: string) => Promise<string>;
  random?: () => number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  qrWaitMs?: number;
  log?: (message: string) => void;
}

/**
 * Converte um telefone cadastrado (ex: "+55 (11) 99999-9999") para dígitos com DDI 55.
 */
export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function statusCodeOf(error: unknown): number | undefined {
  return (error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
}

export class BaileysService implements IWhatsAppGateway {
  private readonly createSocket: () => Promise<WASocketLike>;
  private readonly clearAuth: () => void;
  private readonly hasSession: () => boolean;
  private readonly qrToDataUrl: (qr: string) => Promise<string>;
  private readonly random: () => number;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private readonly qrWaitMs: number;
  private readonly log: (message: string) => void;

  private state: WhatsAppConnectionState = 'close';
  private sock: WASocketLike | null = null;
  private starting: Promise<void> | null = null;
  private qr: string | null = null;
  private attempts = 0;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private waiters: Array<() => void> = [];
  private jidCache = new Map<string, { jid: string | null; at: number }>();

  constructor(config: BaileysServiceConfig) {
    this.createSocket = config.createSocket;
    this.clearAuth = config.clearAuth;
    this.hasSession = config.hasSession;
    this.qrToDataUrl = config.qrToDataUrl ?? ((qr) => QRCode.toDataURL(qr, { margin: 1, width: 320 }));
    this.random = config.random ?? Math.random;
    this.reconnectBaseMs = config.reconnectBaseMs ?? 2000;
    this.reconnectMaxMs = config.reconnectMaxMs ?? 60000;
    this.qrWaitMs = config.qrWaitMs ?? 10000;
    this.log = config.log ?? ((message) => console.log(`[WhatsApp] ${message}`));
  }

  /**
   * Abre a conexão com o WhatsApp (idempotente).
   */
  async start(): Promise<void> {
    this.stopped = false;
    if (this.sock) return;
    if (!this.starting) {
      this.starting = this.connect().finally(() => {
        this.starting = null;
      });
    }
    await this.starting;
  }

  /**
   * Encerra a conexão e cancela qualquer reconexão pendente.
   */
  stop(): void {
    this.stopped = true;
    this.clearReconnectTimer();
    const current = this.sock;
    this.sock = null;
    this.qr = null;
    this.state = 'close';
    current?.end(undefined);
    this.notify();
  }

  async checkInstanceStatus(): Promise<ConnectionStatus> {
    return { state: this.state };
  }

  async getQrCode(): Promise<QrCodeResult> {
    if (this.isOpen()) {
      return { state: 'open' };
    }

    await this.start();

    const deadline = Date.now() + this.qrWaitMs;
    while (!this.isOpen() && !this.qr && (this.sock || this.starting)) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await this.waitForChange(remaining);
    }

    if (this.isOpen()) {
      return { state: 'open' };
    }

    return {
      qrcode: this.qr ? await this.qrToDataUrl(this.qr) : null,
      state: this.state,
    };
  }

  async numberExists(whatsapp: string): Promise<boolean> {
    const sock = this.requireOpenSocket();
    return (await this.lookupJid(sock, whatsapp)) !== null;
  }

  async sendPresence(whatsapp: string, presence: WhatsAppPresence = 'composing'): Promise<boolean> {
    try {
      const sock = this.requireOpenSocket();
      const jid = await this.lookupJid(sock, whatsapp);
      if (!jid) return false;

      await sock.presenceSubscribe(jid);
      await sock.sendPresenceUpdate(presence, jid);
      return true;
    } catch {
      // Falha de presença não deve travar o fluxo principal
      return false;
    }
  }

  async sendText(whatsapp: string, text: string): Promise<SendTextResult> {
    const sock = this.requireOpenSocket();
    const jid = await this.lookupJid(sock, whatsapp);
    if (!jid) {
      throw new NumeroSemWhatsAppError(whatsapp);
    }

    const sent = (await sock.sendMessage(jid, { text })) as { key?: { id?: string | null } } | undefined;
    return { id: sent?.key?.id ?? null, jid };
  }

  private async connect(): Promise<void> {
    this.clearReconnectTimer();
    this.state = 'connecting';
    this.notify();

    try {
      const sock = await this.createSocket();
      this.sock = sock;
      sock.ev.on('connection.update', (update) => this.handleUpdate(sock, update));
    } catch (err) {
      this.log(`Falha ao abrir a conexão: ${err instanceof Error ? err.message : String(err)}`);
      this.state = 'close';
      this.notify();
      if (!this.stopped) this.scheduleReconnect();
    }
  }

  private handleUpdate(sock: WASocketLike, update: ConnectionUpdate): void {
    // Eventos de um socket que já foi substituído ou encerrado não valem mais
    if (sock !== this.sock) return;

    if (update.qr) {
      this.qr = update.qr;
      this.state = 'connecting';
      this.notify();
    }

    if (update.connection === 'open') {
      this.state = 'open';
      this.qr = null;
      this.attempts = 0;
      this.log('Conectado ao WhatsApp.');
      this.notify();
    }

    if (update.connection === 'close') {
      this.handleClose(update);
    }
  }

  private handleClose(update: ConnectionUpdate): void {
    const code = statusCodeOf(update.lastDisconnect?.error);

    this.sock = null;
    this.qr = null;
    this.state = 'close';
    this.notify();

    if (this.stopped) return;

    if (code === STATUS_LOGGED_OUT) {
      this.log('Aparelho desconectado pelo celular. Sessão apagada: é preciso ler o QR Code novamente.');
      this.clearAuth();
      return;
    }

    if (code === STATUS_CONNECTION_REPLACED) {
      this.log('Sessão aberta em outro lugar. Reconexão automática suspensa.');
      return;
    }

    if (code === STATUS_RESTART_REQUIRED) {
      // Esperado logo após ler o QR Code: o WhatsApp pede para reabrir a conexão
      void this.start();
      return;
    }

    if (!this.hasSession()) {
      // Pareamento nunca concluído (QR expirou): espera o usuário pedir um novo QR
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const raw = Math.min(this.reconnectMaxMs, this.reconnectBaseMs * 2 ** this.attempts);
    const jitter = 0.8 + this.random() * 0.4;
    const delay = Math.min(this.reconnectMaxMs, Math.round(raw * jitter));
    this.attempts += 1;

    this.log(`Conexão perdida. Nova tentativa em ${Math.round(delay / 1000)}s.`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.start();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private isOpen(): boolean {
    return this.state === 'open';
  }

  private requireOpenSocket(): WASocketLike {
    if (this.state !== 'open' || !this.sock) {
      throw new Error('WhatsApp desconectado');
    }
    return this.sock;
  }

  /**
   * Pergunta ao WhatsApp qual é o JID real do número (resolve, por exemplo, números antigos
   * sem o 9º dígito) e guarda o resultado para não consultar de novo a cada mensagem.
   */
  private async lookupJid(sock: WASocketLike, whatsapp: string): Promise<string | null> {
    const number = normalizeWhatsAppNumber(whatsapp);

    const cached = this.jidCache.get(number);
    if (cached && Date.now() - cached.at < JID_CACHE_TTL_MS) {
      return cached.jid;
    }

    const results = await sock.onWhatsApp(number);
    const found = results?.find((item) => item.exists);
    const jid = found ? found.jid : null;

    this.jidCache.set(number, { jid, at: Date.now() });
    return jid;
  }

  private waitForChange(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.waiters = this.waiters.filter((w) => w !== done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.waiters.push(done);
    });
  }

  private notify(): void {
    for (const wake of [...this.waiters]) wake();
  }
}
