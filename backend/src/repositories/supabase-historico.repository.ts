import { SupabaseClient } from '@supabase/supabase-js';
import {
  IHistoricoRepository,
  HistoricoMensagem,
  HistoricoWithVendaCliente,
  TipoMensagem,
} from './historico.repository.interface.js';

const CYCLE_WINDOW_DAYS = 20;

export class SupabaseHistoricoRepository implements IHistoricoRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async findByVendaId(vendaId: number): Promise<HistoricoMensagem[]> {
    const { data, error } = await this.client
      .from('historico_mensagens')
      .select('*')
      .eq('venda_id', vendaId)
      .order('data_envio', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar histórico de mensagens: ${error.message}`);
    }

    return (data || []) as HistoricoMensagem[];
  }

  async findRecentEnviados(limit: number = 50): Promise<HistoricoWithVendaCliente[]> {
    const { data, error } = await this.client
      .from('historico_mensagens')
      .select('id, venda_id, tipo, data_envio, status_envio, mensagem, venda:vendas(id, descricao, valor, valor_total, parcela_atual, total_parcelas, status_mes_atual, data_vencimento_atual, cliente:clientes(id, nome, whatsapp))')
      .eq('status_envio', 'enviado')
      .order('data_envio', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar mensagens enviadas recentemente: ${error.message}`);
    }

    return (data || []) as unknown as HistoricoWithVendaCliente[];
  }

  async create(entry: HistoricoMensagem): Promise<HistoricoMensagem> {
    const { data, error } = await this.client
      .from('historico_mensagens')
      .insert({
        venda_id: entry.venda_id,
        tipo: entry.tipo,
        status_envio: entry.status_envio,
        mensagem: entry.mensagem || null,
        detalhes: entry.detalhes || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao registrar histórico de mensagem: ${error.message}`);
    }

    return data as HistoricoMensagem;
  }

  async hasMessageBeenSentForCycle(
    vendaId: number,
    tipo: TipoMensagem,
    cycleDueDate: string
  ): Promise<boolean> {
    // Busca se existe envio com status 'enviado' para o mesmo tipo no ciclo atual.
    // Os avisos de um ciclo saem no máximo 3 dias antes do vencimento, então 20 dias bastam;
    // uma janela de 30 dias confundia o aviso do mês anterior em meses curtos (ex.: fevereiro).
    const cycleStart = new Date(Date.parse(cycleDueDate) - CYCLE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const { data, error } = await this.client
      .from('historico_mensagens')
      .select('id')
      .eq('venda_id', vendaId)
      .eq('tipo', tipo)
      .eq('status_envio', 'enviado')
      .gte('data_envio', cycleStart.toISOString())
      .limit(1);

    if (error) {
      throw new Error(`Erro ao verificar histórico de envio: ${error.message}`);
    }

    return Array.isArray(data) && data.length > 0;
  }
}
