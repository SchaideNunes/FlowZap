import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { ResumoController } from './resumo.controller.js';
import { MonthlySummaryService, currentMonth } from '../services/monthly-summary.service.js';

describe('ResumoController', () => {
  let service: { getSummary: ReturnType<typeof vi.fn> };
  let controller: ResumoController;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    service = { getSummary: vi.fn().mockImplementation(async (mes: string) => ({ mes })) };
    controller = new ResumoController(service as unknown as MonthlySummaryService);
    req = { query: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  it('devolve o resumo do mês pedido', async () => {
    req.query = { mes: '2026-09' };

    await controller.getMensal(req as Request, res as Response);

    expect(service.getSummary).toHaveBeenCalledWith('2026-09');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ mes: '2026-09' });
  });

  it('sem mês informado, usa o mês atual', async () => {
    await controller.getMensal(req as Request, res as Response);

    expect(service.getSummary).toHaveBeenCalledWith(currentMonth());
  });

  it('recusa mês em formato inválido', async () => {
    for (const mes of ['2026-13', '10/2026', '2026-1', 'abc']) {
      vi.mocked(res.status!).mockClear();
      req.query = { mes };

      await controller.getMensal(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it('devolve 500 quando a consulta falha', async () => {
    service.getSummary.mockRejectedValue(new Error('banco fora'));

    await controller.getMensal(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'banco fora' });
  });
});
