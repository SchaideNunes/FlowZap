import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { ConfiguracaoController } from './configuracao.controller.js';
import { ConfiguracaoService } from '../services/configuracao.service.js';
import { DEFAULT_TEMPLATES } from '../services/template.service.js';

describe('ConfiguracaoController', () => {
  let service: { get: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let controller: ConfiguracaoController;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    service = {
      get: vi.fn().mockResolvedValue({ envio_automatico: true, mensagens: {} }),
      update: vi.fn().mockImplementation(async (patch) => ({ envio_automatico: true, mensagens: {}, ...patch })),
    };
    controller = new ConfiguracaoController(service as unknown as ConfiguracaoService);
    req = { body: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  it('GET devolve a configuração junto com as mensagens padrão e as variáveis', async () => {
    await controller.get(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json!).mock.calls[0][0];
    expect(body.envio_automatico).toBe(true);
    expect(body.mensagens).toEqual({});
    expect(body.padroes).toEqual(DEFAULT_TEMPLATES);
    expect(body.variaveis.map((v: { chave: string }) => v.chave)).toContain('{nome}');
  });

  it('PUT liga e desliga o envio automático', async () => {
    req.body = { envio_automatico: false };

    await controller.update(req as Request, res as Response);

    expect(service.update).toHaveBeenCalledWith({ envio_automatico: false });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(vi.mocked(res.json!).mock.calls[0][0].envio_automatico).toBe(false);
  });

  it('PUT aceita uma mensagem personalizada e nulo para voltar à padrão', async () => {
    req.body = { mensagens: { vencido: '{saudacao} {nome}, sua parcela venceu.', lembrete_1d: null } };

    await controller.update(req as Request, res as Response);

    expect(service.update).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('PUT recusa tipo de mensagem desconhecido', async () => {
    req.body = { mensagens: { confirmacao_manual: 'Texto qualquer aqui' } };

    await controller.update(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('PUT recusa mensagem curta demais, longa demais ou com variável desconhecida', async () => {
    for (const texto of ['Oi', '{saudacao} ' + 'x'.repeat(1001), '{saudacao} {cliente}, sua parcela venceu.']) {
      vi.mocked(res.status!).mockClear();
      req.body = { mensagens: { vencido: texto } };

      await controller.update(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(service.update).not.toHaveBeenCalled();
  });

  it('PUT recusa mensagem sem {saudacao}: a saudação variada protege o número contra bloqueio', async () => {
    req.body = { mensagens: { vencido: 'Olá {nome}, sua parcela venceu.' } };

    await controller.update(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(vi.mocked(res.json!).mock.calls[0][0].error).toContain('{saudacao}');
    expect(service.update).not.toHaveBeenCalled();
  });

  it('PUT recusa corpo sem nada para alterar', async () => {
    req.body = {};

    await controller.update(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('PUT devolve 500 com a explicação quando a gravação falha', async () => {
    service.update.mockRejectedValue(new Error('rode a migração'));
    req.body = { envio_automatico: true };

    await controller.update(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'rode a migração' });
  });
});
