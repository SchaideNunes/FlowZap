import { TipoMensagem } from '../repositories/historico.repository.interface.js';
import { TipoAviso } from '../repositories/configuracao.repository.interface.js';

export interface TemplateData {
  nome: string;
  descricao?: string | null;
  valor: number;
  dataVencimento: string; // formato formatado DD/MM/AAAA ou YYYY-MM-DD
  parcelaAtual?: number | null;
  totalParcelas?: number | null;
  /** Chave Pix da loja (variável {pix}); vazia quando não configurada. */
  chavePix?: string | null;
}

/**
 * Variáveis que o usuário pode usar ao escrever a própria mensagem.
 */
export const TEMPLATE_VARIABLES: { chave: string; descricao: string }[] = [
  { chave: '{saudacao}', descricao: 'Saudação que muda a cada envio (Olá, Oi...)' },
  { chave: '{nome}', descricao: 'Nome do cliente' },
  { chave: '{produto}', descricao: 'Descrição da venda, com a parcela quando houver' },
  { chave: '{valor}', descricao: 'Valor da parcela, sem o "R$"' },
  { chave: '{vencimento}', descricao: 'Data de vencimento (DD/MM/AAAA)' },
  { chave: '{pix}', descricao: 'Chave Pix da loja (cadastrada acima)' },
  { chave: '{referencia}', descricao: 'Trecho " referente a *produto*" (some se a venda não tiver descrição)' },
];

/**
 * Mensagens padrão de cada aviso, usadas enquanto o usuário não escrever a sua.
 */
export const DEFAULT_TEMPLATES: Record<TipoAviso, string> = {
  lembrete_3d:
    '{saudacao} {nome}, passando para lembrar que sua cobrança{referencia}, no valor de *R$ {valor}*, vence em 3 dias, no dia *{vencimento}*.',
  lembrete_2d:
    '{saudacao} {nome}, passando para lembrar que sua cobrança{referencia}, no valor de *R$ {valor}*, vence em 2 dias, no dia *{vencimento}*.',
  lembrete_1d:
    '{saudacao} {nome}, sua cobrança{referencia}, no valor de *R$ {valor}*, vence amanhã, dia *{vencimento}*.',
  vencido:
    '{saudacao} {nome}, identificamos que sua cobrança{referencia}, no valor de *R$ {valor}*, com vencimento em *{vencimento}*, ainda está em aberto. Qualquer dúvida ou se já efetuou o pagamento, nos avise por favor!',
};

const EXTRA_TEMPLATES: Partial<Record<TipoMensagem, string>> = {
  confirmacao_manual:
    '{saudacao} {nome}, confirmamos o recebimento do pagamento da sua cobrança{referencia}. Muito obrigado!',
};

const FALLBACK_TEMPLATE = '{saudacao} {nome}, lembrete de cobrança{referencia} no valor de R$ {valor}.';

const VARIABLE_PATTERN = /\{[^{}\s]*\}/g;

/**
 * Lista as variáveis escritas no texto que o sistema não conhece (ex.: "{cliente}").
 */
export function findUnknownVariables(template: string): string[] {
  const known = new Set(TEMPLATE_VARIABLES.map((v) => v.chave));
  const found = template.match(VARIABLE_PATTERN) || [];
  return [...new Set(found.filter((variable) => !known.has(variable)))];
}

export class TemplateService {
  private greetings = ['Olá', 'Oi', 'Tudo bem?', 'Como vai?'];

  getDynamicGreeting(): string {
    const randomIndex = Math.floor(Math.random() * this.greetings.length);
    return this.greetings[randomIndex];
  }

  private formatCurrency(value: number): string {
    return Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Monta a mensagem do aviso. Com `customTemplate` (texto escrito pelo usuário) usa esse texto;
   * sem ele, a mensagem padrão do tipo.
   */
  generateMessage(tipo: TipoMensagem, data: TemplateData, customTemplate?: string | null): string {
    const parcelado = Boolean(data.parcelaAtual && data.totalParcelas && data.totalParcelas > 1);
    const parcelaText = parcelado ? `Parcela ${data.parcelaAtual} de ${data.totalParcelas}` : '';

    let produto = '';
    let referencia = '';
    if (data.descricao) {
      produto = parcelado ? `${data.descricao} (${parcelaText})` : data.descricao;
      referencia = ` referente a *${produto}*`;
    } else if (parcelado) {
      produto = parcelaText;
      referencia = ` referente à *${parcelaText}*`;
    }

    const values: Record<string, string> = {
      '{saudacao}': this.getDynamicGreeting(),
      '{nome}': data.nome,
      '{produto}': produto,
      '{valor}': this.formatCurrency(data.valor),
      '{vencimento}': data.dataVencimento,
      '{referencia}': referencia,
      '{pix}': data.chavePix || '',
    };

    const template =
      customTemplate?.trim() ||
      (DEFAULT_TEMPLATES as Partial<Record<TipoMensagem, string>>)[tipo] ||
      EXTRA_TEMPLATES[tipo] ||
      FALLBACK_TEMPLATE;

    return template.replace(VARIABLE_PATTERN, (variable) => values[variable] ?? variable);
  }
}
