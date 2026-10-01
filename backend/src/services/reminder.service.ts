import { IVendaRepository } from '../repositories/venda.repository.interface.js';
import { IHistoricoRepository, TipoMensagem } from '../repositories/historico.repository.interface.js';
import { BillingService } from './billing.service.js';
import { TemplateService } from './template.service.js';
import { MessageQueueService } from './message-queue.service.js';
import { formatDateToISO, daysDifference } from '../utils/date-calculator.js';

export interface ReminderPreviewItem {
  vendaId: number;
  clienteId: number;
  clienteNome: string;
  whatsapp: string;
  descricao?: string | null;
  valor: number;
  dataVencimento: string;
  tipo: TipoMensagem;
  mensagem: string;
}

export interface OverdueReminderItem {
  vendaId: number;
  clienteId: number;
  clienteNome: string;
  whatsapp: string;
  descricao?: string | null;
  valor: number;
  valorTotal?: number | null;
  parcelaAtual?: number | null;
  totalParcelas?: number | null;
  dataVencimento: string; // "DD/MM/AAAA"
  dataVencimentoISO: string; // "YYYY-MM-DD"
  diasAtraso: number;
  statusMesAtual: string;
  mensagemCobranca: string;
  ultimoEnvio?: {
    tipo: TipoMensagem;
    dataEnvio: string;
    statusEnvio: string;
  } | null;
}

export interface EnviadoItem {
  id: number;
  vendaId: number;
  clienteId: number;
  clienteNome: string;
  whatsapp: string;
  descricao?: string | null;
  valor: number;
  dataVencimento: string;
  dataEnvio: string;
  tipo: TipoMensagem;
  mensagem: string;
  statusMesAtual: string;
}

export interface CentralNotificacoesResult {
  agendadosHoje: ReminderPreviewItem[];
  emAtraso: OverdueReminderItem[];
  enviadosRecentes: EnviadoItem[];
  resumo: {
    totalHoje: number;
    valorHoje: number;
    totalAtrasados: number;
    valorAtrasado: number;
    totalEnviados: number;
    totalPagosAposEnvio: number;
  };
}

export class ReminderService {
  private vendaRepo: IVendaRepository;
  private historicoRepo: IHistoricoRepository;
  private billingService: BillingService;
  private templateService: TemplateService;
  private queueService: MessageQueueService;

  constructor(
    vendaRepo: IVendaRepository,
    historicoRepo: IHistoricoRepository,
    billingService: BillingService,
    templateService: TemplateService,
    queueService: MessageQueueService
  ) {
    this.vendaRepo = vendaRepo;
    this.historicoRepo = historicoRepo;
    this.billingService = billingService;
    this.templateService = templateService;
    this.queueService = queueService;
  }

  /**
   * Identifica e pré-visualiza todas as cobranças elegíveis para envio no dia
   * SEM disparar nenhuma mensagem (usado na tela de confirmação do frontend)
   */
  async previewReminders(referenceDateStr: string = formatDateToISO(new Date())): Promise<ReminderPreviewItem[]> {
    const activeVendas = await this.vendaRepo.findActiveVendas();
    const previews: ReminderPreviewItem[] = [];

    for (const venda of activeVendas) {
      if (!venda.cliente || !venda.cliente.ativo) {
        continue;
      }

      const decision = this.billingService.evaluateReminderState(venda, referenceDateStr);
      if (!decision) {
        continue;
      }

      // Verificação anti-duplicidade no histórico do ciclo
      const alreadySent = await this.historicoRepo.hasMessageBeenSentForCycle(
        venda.id!,
        decision.tipo,
        venda.data_vencimento_atual!
      );

      if (alreadySent) {
        continue;
      }

      // Formatação da data para o usuário (DD/MM/AAAA)
      const [ano, mes, dia] = (venda.data_vencimento_atual || '').split('-');
      const formattedDate = `${dia}/${mes}/${ano}`;

      const message = this.templateService.generateMessage(decision.tipo, {
        nome: venda.cliente.nome,
        descricao: venda.descricao,
        valor: venda.valor,
        dataVencimento: formattedDate,
        parcelaAtual: venda.parcela_atual,
        totalParcelas: venda.total_parcelas,
      });

      previews.push({
        vendaId: venda.id!,
        clienteId: venda.cliente.id,
        clienteNome: venda.cliente.nome,
        whatsapp: venda.cliente.whatsapp,
        descricao: venda.descricao,
        valor: venda.valor,
        dataVencimento: formattedDate,
        tipo: decision.tipo,
        mensagem: message,
      });
    }

    return previews;
  }

  /**
   * Enfileira os lembretes elegíveis na fila anti-ban sequencial
   */
  async dispatchReminders(referenceDateStr: string = formatDateToISO(new Date())): Promise<{
    dispatchedCount: number;
    items: ReminderPreviewItem[];
  }> {
    const eligibleItems = await this.previewReminders(referenceDateStr);

    for (const item of eligibleItems) {
      this.queueService.enqueue({
        whatsapp: item.whatsapp,
        message: item.mensagem,
        onSuccess: async (response) => {
          // Determina o novo status
          let novoStatus: any = 'avisado_3d';
          if (item.tipo === 'lembrete_1d') novoStatus = 'avisado_1d';
          if (item.tipo === 'vencido') novoStatus = 'vencido';

          await this.vendaRepo.updateStatus(item.vendaId, novoStatus);

          await this.historicoRepo.create({
            venda_id: item.vendaId,
            tipo: item.tipo,
            status_envio: 'enviado',
            mensagem: item.mensagem,
            detalhes: response,
          });
        },
        onError: async (error) => {
          await this.historicoRepo.create({
            venda_id: item.vendaId,
            tipo: item.tipo,
            status_envio: 'falha',
            mensagem: item.mensagem,
            detalhes: { error: error?.message || 'Erro desconhecido' },
          });
        },
      });
    }

    return {
      dispatchedCount: eligibleItems.length,
      items: eligibleItems,
    };
  }

  /**
   * Lista todos os contratos/vendas atualmente em atraso com cálculo de dias
   * e último registro de notificação
   */
  async getOverdueReminders(
    referenceDateStr: string = formatDateToISO(new Date())
  ): Promise<OverdueReminderItem[]> {
    const activeVendas = await this.vendaRepo.findActiveVendas();
    const overdues: OverdueReminderItem[] = [];

    for (const venda of activeVendas) {
      if (!venda.cliente || !venda.cliente.ativo) {
        continue;
      }

      if (venda.status_mes_atual === 'pago') {
        continue;
      }

      const dueDate = venda.data_vencimento_atual;
      if (!dueDate) continue;

      const diff = daysDifference(dueDate, referenceDateStr);
      // Considerado em atraso se o status é 'vencido' ou a data já passou (diff <= 0)
      const isOverdue = venda.status_mes_atual === 'vencido' || diff <= 0;

      if (!isOverdue) {
        continue;
      }

      const diasAtraso = diff <= 0 ? Math.abs(diff) : 0;

      // Formatação da data para DD/MM/AAAA
      const [ano, mes, dia] = dueDate.split('-');
      const formattedDate = `${dia}/${mes}/${ano}`;

      // Busca histórico recente para saber se e quando já foi notificado
      let ultimoEnvio: OverdueReminderItem['ultimoEnvio'] = null;
      try {
        const historicos = await this.historicoRepo.findByVendaId(venda.id!);
        if (historicos && historicos.length > 0) {
          const last = historicos[0]; // mais recente
          ultimoEnvio = {
            tipo: last.tipo,
            dataEnvio: last.data_envio || '',
            statusEnvio: last.status_envio,
          };
        }
      } catch {
        // histórico opcional
      }

      const mensagemCobranca = this.templateService.generateMessage('vencido', {
        nome: venda.cliente.nome,
        descricao: venda.descricao,
        valor: Number(venda.valor),
        dataVencimento: formattedDate,
        parcelaAtual: venda.parcela_atual,
        totalParcelas: venda.total_parcelas,
      });

      overdues.push({
        vendaId: venda.id!,
        clienteId: venda.cliente.id,
        clienteNome: venda.cliente.nome,
        whatsapp: venda.cliente.whatsapp,
        descricao: venda.descricao,
        valor: Number(venda.valor),
        valorTotal: venda.valor_total ? Number(venda.valor_total) : null,
        parcelaAtual: venda.parcela_atual,
        totalParcelas: venda.total_parcelas,
        dataVencimento: formattedDate,
        dataVencimentoISO: dueDate,
        diasAtraso,
        statusMesAtual: venda.status_mes_atual,
        mensagemCobranca,
        ultimoEnvio,
      });
    }

    // Ordena do mais atrasado para o mais recente
    return overdues.sort((a, b) => b.diasAtraso - a.diasAtraso);
  }

  /**
   * Retorna visão unificada da Central de Notificações
   */
  async getCentralNotificacoes(
    referenceDateStr: string = formatDateToISO(new Date())
  ): Promise<CentralNotificacoesResult> {
    const [agendadosHoje, emAtraso, rawEnviados] = await Promise.all([
      this.previewReminders(referenceDateStr),
      this.getOverdueReminders(referenceDateStr),
      this.historicoRepo.findRecentEnviados ? this.historicoRepo.findRecentEnviados(50) : Promise.resolve([]),
    ]);

    const enviadosRecentes: EnviadoItem[] = (rawEnviados || []).map((h) => {
      const v = h.venda;
      const c = v?.cliente;

      const [ano, mes, dia] = (v?.data_vencimento_atual || '').split('-');
      const formattedDate = dia && mes && ano ? `${dia}/${mes}/${ano}` : '-';

      return {
        id: h.id!,
        vendaId: h.venda_id,
        clienteId: c?.id || 0,
        clienteNome: c?.nome || 'Cliente',
        whatsapp: c?.whatsapp || '',
        descricao: v?.descricao || null,
        valor: Number(v?.valor || 0),
        dataVencimento: formattedDate,
        dataEnvio: h.data_envio || '',
        tipo: h.tipo,
        mensagem: h.mensagem || '',
        statusMesAtual: v?.status_mes_atual || 'pendente',
      };
    });

    const valorHoje = agendadosHoje.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
    const valorAtrasado = emAtraso.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
    const totalPagosAposEnvio = enviadosRecentes.filter((e) => e.statusMesAtual === 'pago').length;

    return {
      agendadosHoje,
      emAtraso,
      enviadosRecentes,
      resumo: {
        totalHoje: agendadosHoje.length,
        valorHoje,
        totalAtrasados: emAtraso.length,
        valorAtrasado,
        totalEnviados: enviadosRecentes.length,
        totalPagosAposEnvio,
      },
    };
  }
}
