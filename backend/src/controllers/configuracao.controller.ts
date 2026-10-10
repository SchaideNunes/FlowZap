import { Request, Response } from 'express';
import { ConfiguracaoService } from '../services/configuracao.service.js';
import { Configuracao } from '../repositories/configuracao.repository.interface.js';
import { UpdateConfiguracaoSchema } from '../schemas/configuracao.schema.js';
import { DEFAULT_TEMPLATES, TEMPLATE_VARIABLES } from '../services/template.service.js';

export class ConfiguracaoController {
  private service: ConfiguracaoService;

  constructor(service: ConfiguracaoService) {
    this.service = service;
  }

  private present(config: Configuracao) {
    return {
      envio_automatico: config.envio_automatico,
      mensagens: config.mensagens,
      chave_pix: config.chave_pix ?? null,
      padroes: DEFAULT_TEMPLATES,
      variaveis: TEMPLATE_VARIABLES,
    };
  }

  get = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(this.present(await this.service.get()));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar as configurações';
      res.status(500).json({ error: msg });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const parse = UpdateConfiguracaoSchema.safeParse(req.body);
    if (!parse.success) {
      const firstIssue = parse.error.issues[0]?.message;
      res.status(400).json({
        error: firstIssue || 'Erro de validação',
        detalhes: parse.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      res.status(200).json(this.present(await this.service.update(parse.data)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar as configurações';
      res.status(500).json({ error: msg });
    }
  };
}
