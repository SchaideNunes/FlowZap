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

export type TipoAviso = 'lembrete_3d' | 'lembrete_2d' | 'lembrete_1d' | 'vencido';

export interface ConfiguracaoData {
  envio_automatico: boolean;
  /** Textos escritos pelo usuário; aviso sem texto próprio usa o de `padroes`. */
  mensagens: Partial<Record<TipoAviso, string>>;
  padroes: Record<TipoAviso, string>;
  variaveis: { chave: string; descricao: string }[];
}

export interface BackupSnapshot {
  app: 'flowzap';
  versao: number;
  gerado_em: string;
  totais: Record<string, number>;
  tabelas: Record<string, Record<string, unknown>[]>;
}

export interface BackupStatus {
  ultimo_backup_em: string | null;
  automatico_neste_computador: boolean;
  guardados: number;
}

export interface HistoricoItem {
  id: number;
  venda_id: number;
  tipo: 'lembrete_3d' | 'lembrete_2d' | 'lembrete_1d' | 'vencido' | 'confirmacao_manual';
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

export interface SedeInfo {
  online: boolean;
  lastSeen: string | null;
}

export interface WhatsAppStatus {
  state: 'open' | 'connecting' | 'close' | 'refused' | 'unknown';
  /** false quando este painel não roda na máquina-sede e, portanto, não envia mensagens. */
  available?: boolean;
  /** Estado da máquina-sede informado pelo Supabase (só no painel online). */
  sede?: SedeInfo | null;
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
  tipo: string;
  mensagem: string;
  statusMesAtual: string;
}

export interface CentralNotificacoesData {
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

export interface ContaPagar {
  id: number;
  nome_credor: string;
  descricao?: string | null;
  valor: number;
  data_vencimento?: string | null;
  pago: boolean;
  data_pagamento?: string | null;
  observacoes?: string | null;
  criado_em?: string;
  atualizado_em?: string;
}


