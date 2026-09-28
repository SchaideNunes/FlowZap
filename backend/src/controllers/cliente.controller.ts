import { Request, Response } from 'express';
import { IClienteRepository } from '../repositories/cliente.repository.interface.js';
import { CreateClienteSchema, UpdateClienteSchema } from '../schemas/cliente.schema.js';

export class ClienteController {
  private clienteRepo: IClienteRepository;

  constructor(clienteRepo: IClienteRepository) {
    this.clienteRepo = clienteRepo;
  }

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const search = typeof req.query.busca === 'string' ? req.query.busca : undefined;
      const clientes = await this.clienteRepo.findAll(search);
      res.status(200).json(clientes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao listar clientes';
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

      const cliente = await this.clienteRepo.findById(id);
      if (!cliente) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
      }

      res.status(200).json(cliente);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar cliente';
      res.status(500).json({ error: msg });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const parse = CreateClienteSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: 'Erro de validação',
        detalhes: parse.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const created = await this.clienteRepo.create(parse.data);
      res.status(201).json(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar cliente';
      res.status(500).json({ error: msg });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const parse = UpdateClienteSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: 'Erro de validação',
        detalhes: parse.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const updated = await this.clienteRepo.update(id, parse.data);
      res.status(200).json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar cliente';
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
      await this.clienteRepo.delete(id);
      res.status(204).send();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir cliente';
      res.status(500).json({ error: msg });
    }
  };
}
