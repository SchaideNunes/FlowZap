import { describe, it, expect } from 'vitest';
import { UnavailableWhatsAppGateway } from './unavailable-gateway.js';

describe('UnavailableWhatsAppGateway', () => {
  const gateway = new UnavailableWhatsAppGateway();

  it('sempre informa WhatsApp desconectado, sem QR Code', async () => {
    expect(await gateway.checkInstanceStatus()).toEqual({ state: 'close', available: false });
    expect(await gateway.getQrCode()).toEqual({ state: 'close', qrcode: null });
  });

  it('presença devolve false sem lançar erro', async () => {
    expect(await gateway.sendPresence('5511999999999', 'composing')).toBe(false);
  });

  it('recusa envio e verificação de número com mensagem clara', async () => {
    await expect(gateway.sendText('5511999999999', 'Oi')).rejects.toThrow(/máquina-sede/);
    await expect(gateway.numberExists('5511999999999')).rejects.toThrow(/máquina-sede/);
  });
});
