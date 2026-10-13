import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { CobrancaController } from './cobranca.controller.js';

describe('CobrancaController: trava de sede única', () => {
  let reminder: { dispatchReminders: ReturnType<typeof vi.fn> };
  let gateway: { checkInstanceStatus: ReturnType<typeof vi.fn> };
  let lock: { isHolder: ReturnType<typeof vi.fn>; getInfo: ReturnType<typeof vi.fn>; takeOver: ReturnType<typeof vi.fn> };
  let res: Partial<Response>;

  const info = { disponivel: true, souSede: false, sedeNome: 'PC-LOJA', sedeVistaEm: '2026-10-13T12:00:00.000Z' };
  const build = (withLock = true) =>
    new CobrancaController(reminder as any, gateway as any, {} as any, undefined, withLock ? (lock as any) : undefined);

  beforeEach(() => {
    reminder = { dispatchReminders: vi.fn().mockResolvedValue({ dispatchedCount: 2, items: [] }) };
    gateway = { checkInstanceStatus: vi.fn().mockResolvedValue({ state: 'open' }) };
    lock = {
      isHolder: vi.fn().mockReturnValue(false),
      getInfo: vi.fn().mockReturnValue(info),
      takeOver: vi.fn().mockResolvedValue(true),
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  it('recusa o disparo manual em uma máquina que não é a sede, dizendo quem é', async () => {
    await build().disparar({} as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(vi.mocked(res.json!).mock.calls[0][0].error).toContain('PC-LOJA');
    expect(reminder.dispatchReminders).not.toHaveBeenCalled();
  });

  it('a sede dispara normalmente', async () => {
    lock.isHolder.mockReturnValue(true);

    await build().disparar({} as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(reminder.dispatchReminders).toHaveBeenCalledTimes(1);
  });

  it('quem não é a sede vê o painel como o painel online: sem envio, com o estado da sede de verdade', async () => {
    const sedeRepo = {
      getStatus: vi.fn().mockResolvedValue({ estado_whatsapp: 'open', atualizado_em: new Date().toISOString() }),
    };
    const controller = new CobrancaController(reminder as any, gateway as any, {} as any, sedeRepo as any, lock as any);

    await controller.getWhatsAppStatus({} as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({
      state: 'open',
      available: false,
      sede: { online: true, lastSeen: expect.any(String) },
      trava: info,
    });
  });

  it('a sede vê o próprio estado do WhatsApp, com a situação da trava', async () => {
    lock.isHolder.mockReturnValue(true);
    lock.getInfo.mockReturnValue({ disponivel: true, souSede: true });

    await build().getWhatsAppStatus({} as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({ state: 'open', trava: { disponivel: true, souSede: true } });
  });

  it('"usar este computador como sede" toma a trava e devolve a nova situação', async () => {
    lock.getInfo.mockReturnValue({ disponivel: true, souSede: true });

    await build().assumirSede({} as Request, res as Response);

    expect(lock.takeOver).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ trava: { disponivel: true, souSede: true } });
  });

  it('avisa quando não consegue tomar a trava', async () => {
    lock.takeOver.mockResolvedValue(false);

    await build().assumirSede({} as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('no painel online não existe sede para assumir', async () => {
    await build(false).assumirSede({} as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});
