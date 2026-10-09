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

export interface PagamentoRecebido {
  id: number;
  venda_id: number;
  data_pagamento: string;
  valor: number;
  vencimento: string | null;
  parcela: number | null;
  total_parcelas: number | null;
  descricao: string | null;
  cliente_nome: string | null;
}

/**
 * Retrato da parcela no momento do pagamento: a venda avança de ciclo logo em seguida,
 * então o valor e o vencimento pagos só ficam guardados aqui.
 */
function snapshotPagamento(venda: VendaWithCliente): Record<string, unknown> {
  const parcelado = Boolean(venda.total_parcelas && venda.total_parcelas > 1);
  return {
    valor: Number(venda.valor),
    vencimento: venda.data_vencimento_atual || null,
    parcela: parcelado ? venda.parcela_atual || 1 : null,
    total_parcelas: parcelado ? venda.total_parcelas! : null,
  };
}

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

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

    // Se a venda possui parcelas definidas (> 1)
    if (venda.total_parcelas && venda.total_parcelas > 1) {
      const proximaParcela = (venda.parcela_atual || 1) + 1;

      // Se todas as parcelas foram pagas, finaliza e inativa a cobrança
      if (proximaParcela > venda.total_parcelas) {
        const updated = await this.vendaRepo.update(vendaId, {
          status_mes_atual: 'pago',
          ativo: false,
          parcela_atual: venda.total_parcelas,
        });

        await this.historicoRepo.create({
          venda_id: vendaId,
          tipo: 'confirmacao_manual',
          status_envio: 'enviado',
          mensagem: `Venda totalmente quitada! Todas as ${venda.total_parcelas} parcelas foram pagas.`,
          detalhes: snapshotPagamento(venda),
        });

        return updated;
      }

      // Avança para a próxima parcela e próximo vencimento mensal
      const nextDueDate = calculateNextMonthDueDate(
        venda.dia_vencimento,
        venda.data_vencimento_atual || calculateInitialDueDate(venda.dia_vencimento)
      );

      const updated = await this.vendaRepo.update(vendaId, {
        status_mes_atual: 'pendente',
        data_vencimento_atual: nextDueDate,
        parcela_atual: proximaParcela,
      });

      await this.historicoRepo.create({
        venda_id: vendaId,
        tipo: 'confirmacao_manual',
        status_envio: 'enviado',
        mensagem: `Pagamento da parcela ${venda.parcela_atual || 1}/${venda.total_parcelas} confirmado. Próxima parcela: ${proximaParcela}/${venda.total_parcelas}`,
        detalhes: snapshotPagamento(venda),
      });

      return updated;
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
      detalhes: snapshotPagamento(venda),
    });

    return updated;
  }

  /**
   * Pagamentos já confirmados, do mais recente para o mais antigo
   */
  async listPagamentos(limit: number = 100): Promise<PagamentoRecebido[]> {
    const registros = await this.historicoRepo.findPagamentos(limit);

    return registros.map((registro) => {
      const detalhes = registro.detalhes || {};
      return {
        id: registro.id!,
        venda_id: registro.venda_id,
        data_pagamento: registro.data_envio || '',
        valor: numberOrNull(detalhes.valor) ?? Number(registro.venda?.valor ?? 0),
        vencimento: typeof detalhes.vencimento === 'string' ? detalhes.vencimento : null,
        parcela: numberOrNull(detalhes.parcela),
        total_parcelas: numberOrNull(detalhes.total_parcelas),
        descricao: registro.venda?.descricao ?? null,
        cliente_nome: registro.venda?.cliente?.nome ?? null,
      };
    });
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

    // Janela de aviso: um lembrete por dia nos 3 dias anteriores ao vencimento
    // (3 dias, 2 dias e 1 dia antes). Depois vem o aviso final (vencido).
    if (diff === 3 && venda.status_mes_atual === 'pendente') {
      return {
        tipo: 'lembrete_3d',
        novoStatus: 'avisado_3d',
      };
    }

    if (diff === 2 && (venda.status_mes_atual === 'pendente' || venda.status_mes_atual === 'avisado_3d')) {
      return {
        tipo: 'lembrete_2d',
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
