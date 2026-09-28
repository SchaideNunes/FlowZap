import { IVendaRepository, VendaWithCliente } from '../repositories/venda.repository.interface.js';
import { IClienteRepository } from '../repositories/cliente.repository.interface.js';
import { IHistoricoRepository, TipoMensagem } from '../repositories/historico.repository.interface.js';
import { CreateVendaDTO, VendaDTO, VendaStatus } from '../schemas/venda.schema.js';
import {
  calculateInitialDueDate,
  calculateNextMonthDueDate,
  daysDifference,
  formatDateToISO,
} from '../utils/date-calculator.js';

export interface ReminderDecision {
  tipo: TipoMensagem;
  novoStatus: VendaStatus;
}

export class BillingService {
  private vendaRepo: IVendaRepository;
  private clienteRepo: IClienteRepository;
  private historicoRepo: IHistoricoRepository;

  constructor(
    vendaRepo: IVendaRepository,
    clienteRepo: IClienteRepository,
    historicoRepo: IHistoricoRepository
  ) {
    this.vendaRepo = vendaRepo;
    this.clienteRepo = clienteRepo;
    this.historicoRepo = historicoRepo;
  }

  /**
   * Cadastra uma nova venda, calculando o ciclo inicial de vencimento
   */
  async createVenda(data: CreateVendaDTO): Promise<VendaDTO> {
    const cliente = await this.clienteRepo.findById(data.cliente_id);
    if (!cliente) {
      throw new Error('Cliente não encontrado');
    }

    const dueDate = data.data_vencimento_atual || calculateInitialDueDate(data.dia_vencimento);

    return this.vendaRepo.create({
      ...data,
      data_vencimento_atual: dueDate,
    });
  }

  /**
   * Confirmação manual de pagamento de uma venda específica:
   * 1. Registra no histórico de mensagens
   * 2. Calcula nova data_vencimento_atual (+1 mês)
   * 3. Reseta status_mes_atual para pendente
   */
  async markAsPaid(vendaId: number): Promise<VendaDTO> {
    const venda = await this.vendaRepo.findById(vendaId);
    if (!venda) {
      throw new Error('Venda não encontrada');
    }

    const nextDueDate = calculateNextMonthDueDate(
      venda.dia_vencimento,
      venda.data_vencimento_atual || calculateInitialDueDate(venda.dia_vencimento)
    );

    const updated = await this.vendaRepo.updateStatus(vendaId, 'pendente', nextDueDate);

    await this.historicoRepo.create({
      venda_id: vendaId,
      tipo: 'confirmacao_manual',
      status_envio: 'enviado',
      mensagem: 'Pagamento confirmado manualmente pelo usuário',
    });

    return updated;
  }

  /**
   * Avalia o status e lembrete necessário para uma venda no dia de referência
   */
  evaluateReminderState(
    venda: VendaWithCliente,
    referenceDateStr: string = formatDateToISO(new Date())
  ): ReminderDecision | null {
    if (!venda.ativo || venda.status_mes_atual === 'pago') {
      return null;
    }

    const dueDate = venda.data_vencimento_atual;
    if (!dueDate) {
      return null;
    }

    const diff = daysDifference(dueDate, referenceDateStr);

    // 3 dias antes do vencimento
    if (diff === 3 && venda.status_mes_atual === 'pendente') {
      return {
        tipo: 'lembrete_3d',
        novoStatus: 'avisado_3d',
      };
    }

    // 1 dia antes do vencimento
    if (diff === 1 && venda.status_mes_atual !== 'avisado_1d' && venda.status_mes_atual !== 'vencido') {
      return {
        tipo: 'lembrete_1d',
        novoStatus: 'avisado_1d',
      };
    }

    // No dia do vencimento ou posterior (se ainda não pago)
    if (diff <= 0 && venda.status_mes_atual !== 'vencido') {
      return {
        tipo: 'vencido',
        novoStatus: 'vencido',
      };
    }

    return null;
  }
}
