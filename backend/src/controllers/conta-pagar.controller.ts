import { Request, Response } from 'express';
import { IContaPagarRepository } from '../repositories/conta-pagar.repository.interface.js';
import { CreateContaPagarSchema, UpdateContaPagarSchema } from '../schemas/conta-pagar.schema.js';

export class ContaPagarController {
  private repo: IContaPagarRepository;

  constructor(repo: IContaPagarRepository) {
    this.repo = repo;
  }

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const search = typeof req.query.busca === 'string' ? req.query.busca : undefined;
      const items = await this.repo.findAll(search);
      res.status(200).json(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao listar contas a pagar';
      res.status(500).json({ error: msg });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }

      const item = await this.repo.findById(id);
      if (!item) {
        res.status(404).json({ error: 'Conta a pagar não encontrada' });
        return;
      }

      res.status(200).json(item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar conta a pagar';
      res.status(500).json({ error: msg });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const parse = CreateContaPagarSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: 'Erro de validação',
        detalhes: parse.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const created = await this.repo.create(parse.data);
      res.status(201).json(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta a pagar';
      res.status(500).json({ error: msg });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const parse = UpdateContaPagarSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: 'Erro de validação',
        detalhes: parse.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const updated = await this.repo.update(id, parse.data);
      res.status(200).json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar conta a pagar';
      res.status(500).json({ error: msg });
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    try {
      await this.repo.delete(id);
      res.status(204).send();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover conta a pagar';
      res.status(500).json({ error: msg });
    }
  };
}
