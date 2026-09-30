import { TipoMensagem } from '../repositories/historico.repository.interface.js';

export interface TemplateData {
  nome: string;
  descricao?: string | null;
  valor: number;
  dataVencimento: string; // formato formatado DD/MM/AAAA ou YYYY-MM-DD
  parcelaAtual?: number | null;
  totalParcelas?: number | null;
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

  generateMessage(tipo: TipoMensagem, data: TemplateData): string {
    const greeting = this.getDynamicGreeting();
    const formattedValor = this.formatCurrency(data.valor);

    let descText = '';
    if (data.descricao) {
      if (data.parcelaAtual && data.totalParcelas && data.totalParcelas > 1) {
        descText = ` referente a *${data.descricao} (Parcela ${data.parcelaAtual} de ${data.totalParcelas})*`;
      } else {
        descText = ` referente a *${data.descricao}*`;
      }
    } else if (data.parcelaAtual && data.totalParcelas && data.totalParcelas > 1) {
      descText = ` referente à *Parcela ${data.parcelaAtual} de ${data.totalParcelas}*`;
    }

    switch (tipo) {
      case 'lembrete_3d':
        return `${greeting} ${data.nome}, passando para lembrar que sua cobrança${descText}, no valor de *R$ ${formattedValor}*, vence em 3 dias, no dia *${data.dataVencimento}*.`;

      case 'lembrete_1d':
        return `${greeting} ${data.nome}, sua cobrança${descText}, no valor de *R$ ${formattedValor}*, vence amanhã, dia *${data.dataVencimento}*.`;

      case 'vencido':
        return `${greeting} ${data.nome}, identificamos que sua cobrança${descText}, no valor de *R$ ${formattedValor}*, com vencimento em *${data.dataVencimento}*, ainda está em aberto. Qualquer dúvida ou se já efetuou o pagamento, nos avise por favor!`;

      case 'confirmacao_manual':
        return `${greeting} ${data.nome}, confirmamos o recebimento do pagamento da sua cobrança${descText}. Muito obrigado!`;

      default:
        return `${greeting} ${data.nome}, lembrete de cobrança${descText} no valor de R$ ${formattedValor}.`;
    }
  }
}
