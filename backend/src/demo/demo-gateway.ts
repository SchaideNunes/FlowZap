import {
  ConnectionStatus,
  IWhatsAppGateway,
  QrCodeResult,
  SendTextResult,
} from '../services/whatsapp-gateway.interface.js';

/**
 * WhatsApp da demonstração: sempre "conectado" e nunca envia nada. As mensagens que a fila
 * mandaria ficam em `enviadas` e aparecem no log, para mostrar o disparo funcionando.
 */
export class DemoWhatsAppGateway implements IWhatsAppGateway {
  readonly enviadas: Array<{ whatsapp: string; texto: string }> = [];

  constructor(private log: (linha: string) => void = (linha) => console.log(linha)) {}

  async checkInstanceStatus(): Promise<ConnectionStatus> {
    return { state: 'open', available: true };
  }

  async getQrCode(): Promise<QrCodeResult> {
    return { state: 'open', qrcode: null };
  }

  async sendPresence(): Promise<boolean> {
    return true;
  }

  async sendText(whatsapp: string, texto: string): Promise<SendTextResult> {
    this.enviadas.push({ whatsapp, texto });
    this.log(`[demo] mensagem que iria para ${whatsapp} (nada foi enviado): ${texto.slice(0, 80)}`);
    return { id: null, jid: `${whatsapp}@s.whatsapp.net` };
  }

  async numberExists(): Promise<boolean> {
    return true;
  }
}
