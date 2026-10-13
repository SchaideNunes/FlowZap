import { Request, Response } from 'express';
import { MonthlySummaryService, currentMonth } from '../services/monthly-summary.service.js';
import { ResumoMensalQuerySchema } from '../schemas/resumo.schema.js';

export class ResumoController {
  private service: MonthlySummaryService;

  constructor(service: MonthlySummaryService) {
    this.service = service;
  }

  getMensal = async (req: Request, res: Response): Promise<void> => {
    const parse = ResumoMensalQuerySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({
        error: parse.error.issues[0]?.message || 'Erro de validação',
        detalhes: parse.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const resumo = await this.service.getSummary(parse.data.mes ?? currentMonth());
      res.status(200).json(resumo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar o resumo do mês';
      res.status(500).json({ error: msg });
    }
  };
}
