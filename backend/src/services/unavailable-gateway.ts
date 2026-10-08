import {
  IWhatsAppGateway,
  ConnectionStatus,
  QrCodeResult,
  SendTextResult,
} from './whatsapp-gateway.interface.js';

const REASON = 'O envio de WhatsApp roda na máquina-sede e não está disponível neste ambiente';

/**
 * Gateway usado onde não há conexão com o WhatsApp (ex.: funções serverless da Vercel).
 * Mantém a API funcionando para cadastros e consultas, informando "desconectado".
 */
export class UnavailableWhatsAppGateway implements IWhatsAppGateway {
  async checkInstanceStatus(): Promise<ConnectionStatus> {
    return { state: 'close', available: false };
  }

  async getQrCode(): Promise<QrCodeResult> {
    return { state: 'close', qrcode: null };
  }

  async sendPresence(): Promise<boolean> {
    return false;
  }

  async sendText(): Promise<SendTextResult> {
    throw new Error(REASON);
  }

  async numberExists(): Promise<boolean> {
    throw new Error(REASON);
  }
}
