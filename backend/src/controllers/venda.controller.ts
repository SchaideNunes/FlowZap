import { Request, Response } from 'express';
import { IVendaRepository } from '../repositories/venda.repository.interface.js';
import { IHistoricoRepository } from '../repositories/historico.repository.interface.js';
import { BillingService } from '../services/billing.service.js';
import { CreateVendaSchema, UpdateVendaSchema } from '../schemas/venda.schema.js';

export class VendaController {
  private vendaRepo: IVendaRepository;
  private historicoRepo: IHistoricoRepository;
  private billingService: BillingService;

  constructor(
    vendaRepo: IVendaRepository,
    historicoRepo: IHistoricoRepository,
    billingService: BillingService
  ) {
    this.vendaRepo = vendaRepo;
    this.historicoRepo = historicoRepo;
    this.billingService = billingService;
  }

  getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const vendas = await this.vendaRepo.findAllVendas();
      res.status(200).json(vendas);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar todas as vendas';
      res.status(500).json({ error: msg });
    }
  };

  getByCliente = async (req: Request, res: Response): Promise<void> => {
    const clienteId = Number(req.params.clienteId);
    if (isNaN(clienteId)) {
      res.status(400).json({ error: 'clienteId inválido' });
      return;
    }

    try {
      const vendas = await this.vendaRepo.findByClienteId(clienteId);
      res.status(200).json(vendas);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar vendas';
      res.status(500).json({ error: msg });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    try {
      const venda = await this.vendaRepo.findById(id);
      if (!venda) {
        res.status(404).json({ error: 'Venda não encontrada' });
        return;
      }

      res.status(200).json(venda);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar venda';
      res.status(500).json({ error: msg });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const parse = CreateVendaSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: 'Erro de validação',
        detalhes: parse.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const created = await this.billingService.createVenda(parse.data);
      res.status(201).json(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar venda';
      res.status(500).json({ error: msg });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const parse = UpdateVendaSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: 'Erro de validação',
        detalhes: parse.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const updated = await this.vendaRepo.update(id, parse.data);
      res.status(200).json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar venda';
      res.status(500).json({ error: msg });
    }
  };

  markAsPaid = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    try {
      const updated = await this.billingService.markAsPaid(id);
      res.status(200).json({
        message: 'Pagamento confirmado com sucesso e novo ciclo gerado',
        venda: updated,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar pagamento';
      res.status(500).json({ error: msg });
    }
  };

  getPagamentos = async (_req: Request, res: Response): Promise<void> => {
    try {
      const pagamentos = await this.billingService.listPagamentos();
      res.status(200).json(pagamentos);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar pagamentos recebidos';
      res.status(500).json({ error: msg });
    }
  };

  undoPayment = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    try {
      const venda = await this.billingService.undoPayment(id);
      res.status(200).json({ message: 'Pagamento desfeito', venda });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desfazer pagamento';
      // "Não encontrado" é 404; os demais são recusas de regra de negócio
      res.status(/não encontrad/i.test(msg) ? 404 : 409).json({ error: msg });
    }
  };

  toggleAtivo = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') {
      res.status(400).json({ error: 'O campo ativo (boolean) é obrigatório' });
      return;
    }

    try {
      const updated = await this.vendaRepo.update(id, { ativo });
      res.status(200).json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar status da venda';
      res.status(500).json({ error: msg });
    }
  };

  getMetrics = async (_req: Request, res: Response): Promise<void> => {
    try {
      const metrics = await this.vendaRepo.getDashboardMetrics();
      res.status(200).json(metrics);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar métricas';
      res.status(500).json({ error: msg });
    }
  };

  getHistorico = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    try {
      const historico = await this.historicoRepo.findByVendaId(id);
      res.status(200).json(historico);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar histórico';
      res.status(500).json({ error: msg });
    }
  };
}
