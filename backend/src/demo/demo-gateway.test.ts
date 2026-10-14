import { describe, it, expect, vi } from 'vitest';
import { DemoWhatsAppGateway } from './demo-gateway.js';

describe('WhatsApp de demonstração', () => {
  it('aparece conectado e não tem QR Code para ler', async () => {
    const gw = new DemoWhatsAppGateway();
    expect((await gw.checkInstanceStatus()).state).toBe('open');
    expect((await gw.getQrCode()).state).toBe('open');
    expect(await gw.numberExists('5511900000101')).toBe(true);
  });

  it('não envia nada: só guarda a mensagem e escreve no log', async () => {
    const log = vi.fn();
    const gw = new DemoWhatsAppGateway(log);
    const res = await gw.sendText('5511900000101', 'Olá Ana');
    expect(res.jid).toBe('5511900000101@s.whatsapp.net');
    expect(gw.enviadas).toEqual([{ whatsapp: '5511900000101', texto: 'Olá Ana' }]);
    expect(log).toHaveBeenCalledOnce();
  });
});
