export type TipoMensagem = 'lembrete_3d' | 'lembrete_2d' | 'lembrete_1d' | 'vencido' | 'confirmacao_manual';
export type StatusEnvio = 'enviado' | 'falha';

export interface HistoricoMensagem {
  id?: number;
  venda_id: number;
  tipo: TipoMensagem;
  data_envio?: string;
  status_envio: StatusEnvio;
  mensagem?: string | null;
  detalhes?: Record<string, unknown> | null;
}

export interface HistoricoWithVendaCliente extends HistoricoMensagem {
  venda?: {
    id: number;
    descricao?: string | null;
    valor: number;
    valor_total?: number | null;
    parcela_atual?: number | null;
    total_parcelas?: number | null;
    status_mes_atual: string;
    data_vencimento_atual: string;
    /** Nome de quem comprou sem cadastro (quando não há cliente). */
    cliente_avulso?: string | null;
    cliente?: {
      id: number;
      nome: string;
      whatsapp: string;
    } | null;
  };
}

export interface IHistoricoRepository {
  findById(id: number): Promise<HistoricoMensagem | null>;
  findByVendaId(vendaId: number): Promise<HistoricoMensagem[]>;
  findRecentEnviados(limit?: number): Promise<HistoricoWithVendaCliente[]>;
  findPagamentos(limit?: number): Promise<HistoricoWithVendaCliente[]>;
  /** Pagamentos confirmados com data em [start, end), do mais recente para o mais antigo. */
  findPagamentosBetween(start: string, end: string): Promise<HistoricoWithVendaCliente[]>;
  /** Quantos avisos de cobrança foram enviados com sucesso em [start, end). */
  countAvisosBetween(start: string, end: string): Promise<number>;
  create(entry: HistoricoMensagem): Promise<HistoricoMensagem>;
  delete(id: number): Promise<void>;
  hasMessageBeenSentForCycle(vendaId: number, tipo: TipoMensagem, cycleDueDate: string): Promise<boolean>;
}
