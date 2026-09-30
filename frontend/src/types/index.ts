export interface User {
  id: string;
  nome: string;
  email: string;
}

export interface Cliente {
  id: number;
  nome: string;
  whatsapp: string;
  ativo: boolean;
  observacoes?: string | null;
  vendas_ativas_count?: number;
}

export type VendaStatus = 'pendente' | 'avisado_3d' | 'avisado_1d' | 'vencido' | 'pago';

export interface Venda {
  id: number;
  cliente_id: number;
  descricao: string;
  valor: number;
  dia_vencimento: number;
  valor_total?: number | null;
  taxa_juros?: number | null;
  total_parcelas?: number | null;
  parcela_atual?: number | null;
  status_mes_atual: VendaStatus;
  data_vencimento_atual: string;
  ativo: boolean;
  cliente?: Cliente;
}

export interface HistoricoItem {
  id: number;
  venda_id: number;
  tipo: 'lembrete_3d' | 'lembrete_1d' | 'vencido' | 'confirmacao_manual';
  data_envio: string;
  status_envio: 'enviado' | 'falha';
  mensagem: string | null;
}

export interface DashboardMetrics {
  totalPendentes: number;
  totalAvisados: number;
  totalVencidos: number;
  totalPagos: number;
  valorTotalMensal: number;
  valorTotalRecebido: number;
}

export interface ReminderPreviewItem {
  vendaId: number;
  clienteId: number;
  clienteNome: string;
  whatsapp: string;
  descricao?: string | null;
  valor: number;
  dataVencimento: string;
  tipo: string;
  mensagem: string;
}

export interface WhatsAppStatus {
  state: 'open' | 'connecting' | 'close' | 'refused' | 'unknown';
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
  dataVencimento: string;
  dataVencimentoISO: string;
  diasAtraso: number;
  statusMesAtual: string;
  mensagemCobranca: string;
  ultimoEnvio?: {
    tipo: string;
    dataEnvio: string;
    statusEnvio: string;
  } | null;
}

export interface CentralNotificacoesData {
  agendadosHoje: ReminderPreviewItem[];
  emAtraso: OverdueReminderItem[];
  resumo: {
    totalHoje: number;
    valorHoje: number;
    totalAtrasados: number;
    valorAtrasado: number;
  };
}

