export type TipoMensagem = 'lembrete_3d' | 'lembrete_1d' | 'vencido' | 'confirmacao_manual';
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

export interface IHistoricoRepository {
  findByVendaId(vendaId: number): Promise<HistoricoMensagem[]>;
  create(entry: HistoricoMensagem): Promise<HistoricoMensagem>;
  hasMessageBeenSentForCycle(vendaId: number, tipo: TipoMensagem, cycleDueDate: string): Promise<boolean>;
}
