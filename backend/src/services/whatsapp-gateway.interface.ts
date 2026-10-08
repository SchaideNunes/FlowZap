export type WhatsAppConnectionState = 'open' | 'connecting' | 'close' | 'refused' | 'unknown';

export type WhatsAppPresence = 'composing' | 'recording' | 'available';

export interface ConnectionStatus {
  state: WhatsAppConnectionState;
  qrcode?: string | null;
  /** false quando este processo não consegue enviar mensagens (ex.: painel na Vercel). */
  available?: boolean;
}

export interface QrCodeResult {
  qrcode?: string | null;
  pairingCode?: string | null;
  state: WhatsAppConnectionState;
}

export interface SendTextResult {
  id?: string | null;
  jid: string;
}

/**
 * Número sem conta no WhatsApp. Erro de dado, não de conexão: reenviar não adianta.
 */
export class NumeroSemWhatsAppError extends Error {
  constructor(whatsapp: string) {
    super(`O número ${whatsapp} não possui WhatsApp`);
    this.name = 'NumeroSemWhatsAppError';
  }
}

/**
 * Contrato de acesso ao WhatsApp. Serviços e controllers dependem apenas desta interface,
 * o que permite trocar a biblioteca de envio e mockar tudo nos testes.
 */
export interface IWhatsAppGateway {
  checkInstanceStatus(): Promise<ConnectionStatus>;
  getQrCode(): Promise<QrCodeResult>;
  sendPresence(whatsapp: string, presence?: WhatsAppPresence): Promise<boolean>;
  sendText(whatsapp: string, text: string): Promise<SendTextResult>;
  numberExists(whatsapp: string): Promise<boolean>;
}
