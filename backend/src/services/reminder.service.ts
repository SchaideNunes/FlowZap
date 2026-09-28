import { IVendaRepository } from '../repositories/venda.repository.interface.js';
import { IHistoricoRepository, TipoMensagem } from '../repositories/historico.repository.interface.js';
import { BillingService } from './billing.service.js';
import { TemplateService } from './template.service.js';
import { MessageQueueService } from './message-queue.service.js';
import { formatDateToISO } from '../utils/date-calculator.js';

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
}
