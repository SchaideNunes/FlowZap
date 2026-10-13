import { IHistoricoRepository } from '../repositories/historico.repository.interface.js';
import { IVendaRepository } from '../repositories/venda.repository.interface.js';
import { IClienteRepository } from '../repositories/cliente.repository.interface.js';
import { IContaPagarRepository } from '../repositories/conta-pagar.repository.interface.js';

// A loja fica no Brasil (UTC-3, sem horário de verão). Os meses são contados nesse horário
// mesmo quando o painel roda na nuvem, onde o relógio do servidor é UTC.
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;
const HISTORY_MONTHS = 6;

interface Totals {
  total: number;
  quantidade: number;
}

export interface MonthlySummary {
  /** Mês do resumo (YYYY-MM). */
  mes: string;
  /** Pagamentos confirmados no mês. */
  recebido: Totals;
  /** Parcelas com vencimento no mês que ainda não foram pagas. */
  a_receber: Totals;
  /** Parte de `a_receber` que já passou do vencimento. */
  vencido: Totals;
  vendas_novas: { quantidade: number; valor_total: number };
  clientes_novos: number;
  /** Contas a pagar quitadas no mês. */
  contas_pagas: Totals;
  /** Contas com vencimento no mês ainda não pagas. */
  contas_em_aberto: Totals;
  /** Recebido menos contas pagas. */
  saldo: number;
  avisos_enviados: number;
  /** Avisos de cobrança enviados no dia de hoje (independe do mês consultado). */
  avisos_enviados_hoje: number;
  pagamentos: {
    id: number;
    data_pagamento: string;
    cliente_nome: string | null;
    descricao: string | null;
    valor: number;
    parcela: number | null;
    total_parcelas: number | null;
  }[];
  vendas: {
    id: number;
    cliente_nome: string | null;
    descricao: string | null;
    valor: number;
    valor_total: number;
    total_parcelas: number;
    criado_em: string;
  }[];
  contas: {
    id: number;
    nome_credor: string;
    descricao: string | null;
    valor: number;
    data_vencimento: string | null;
    pago: boolean;
    data_pagamento: string | null;
  }[];
  /** Evolução dos últimos meses, do mais antigo para o mês escolhido. */
  historico: { mes: string; recebido: number; pago: number; saldo: number }[];
}

const toBrazil = (date: Date) => new Date(date.getTime() - BRAZIL_OFFSET_MS);

/** Mês (YYYY-MM) de um instante, no horário do Brasil. */
const monthOfInstant = (iso?: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : toBrazil(date).toISOString().slice(0, 7);
};

/** Mês (YYYY-MM) de uma data sem hora (YYYY-MM-DD). */
const monthOfDate = (date?: string | null): string | null => (date ? date.slice(0, 7) : null);

const addMonths = (mes: string, delta: number): string => {
  const [year, month] = mes.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
};

/** Instante (UTC) em que o mês começa no horário do Brasil. */
const monthStart = (mes: string): string => {
  const [year, month] = mes.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1) + BRAZIL_OFFSET_MS).toISOString();
};

const round = (value: number) => Math.round(value * 100) / 100;
const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function currentMonth(now: Date = new Date()): string {
  return toBrazil(now).toISOString().slice(0, 7);
}

/**
 * Tudo o que aconteceu em um mês: recebido, a receber, vendas e clientes novos, contas e avisos.
 */
export class MonthlySummaryService {
  private historicoRepo: IHistoricoRepository;
  private vendaRepo: IVendaRepository;
  private clienteRepo: IClienteRepository;
  private contaPagarRepo: IContaPagarRepository;

  constructor(
    historicoRepo: IHistoricoRepository,
    vendaRepo: IVendaRepository,
    clienteRepo: IClienteRepository,
    contaPagarRepo: IContaPagarRepository
  ) {
    this.historicoRepo = historicoRepo;
    this.vendaRepo = vendaRepo;
    this.clienteRepo = clienteRepo;
    this.contaPagarRepo = contaPagarRepo;
  }

  async getSummary(mes: string, now: Date = new Date()): Promise<MonthlySummary> {
    const meses = Array.from({ length: HISTORY_MONTHS }, (_, i) => addMonths(mes, i - (HISTORY_MONTHS - 1)));
    const fimDoMes = monthStart(addMonths(mes, 1));
    const hoje = toBrazil(now).toISOString().slice(0, 10);

    const inicioDoDia = new Date(Date.parse(`${hoje}T00:00:00.000Z`) + BRAZIL_OFFSET_MS);
    const fimDoDia = new Date(inicioDoDia.getTime() + 24 * 60 * 60 * 1000);

    const [registros, avisosEnviados, avisosHoje, vendas, clientes, contas] = await Promise.all([
      this.historicoRepo.findPagamentosBetween(monthStart(meses[0]), fimDoMes),
      this.historicoRepo.countAvisosBetween(monthStart(mes), fimDoMes),
      this.historicoRepo.countAvisosBetween(inicioDoDia.toISOString(), fimDoDia.toISOString()),
      this.vendaRepo.findAllVendas(),
      this.clienteRepo.findAll(),
      this.contaPagarRepo.findAll(),
    ]);

    // Pagamentos recebidos, com o mês em que cada um entrou
    const pagamentos = registros.map((registro) => {
      const detalhes = registro.detalhes || {};
      return {
        mes: monthOfInstant(registro.data_envio),
        id: registro.id!,
        data_pagamento: registro.data_envio || '',
        cliente_nome: registro.venda?.cliente?.nome ?? registro.venda?.cliente_avulso ?? null,
        descricao: registro.venda?.descricao ?? null,
        valor: numberOrNull(detalhes.valor) ?? Number(registro.venda?.valor ?? 0),
        parcela: numberOrNull(detalhes.parcela),
        total_parcelas: numberOrNull(detalhes.total_parcelas),
      };
    });

    const recebidoEm = (m: string) => round(pagamentos.filter((p) => p.mes === m).reduce((acc, p) => acc + p.valor, 0));
    const pagoEm = (m: string) =>
      round(
        contas
          .filter((c) => c.pago && monthOfDate(c.data_pagamento) === m)
          .reduce((acc, c) => acc + Number(c.valor || 0), 0)
      );

    const pagamentosDoMes = pagamentos.filter((p) => p.mes === mes).map(({ mes: _mes, ...resto }) => resto);

    // O que ainda falta receber com vencimento neste mês
    const emAberto = vendas.filter(
      (v) => v.ativo && v.status_mes_atual !== 'pago' && monthOfDate(v.data_vencimento_atual) === mes
    );
    const vencidas = emAberto.filter((v) => (v.data_vencimento_atual || '') < hoje);
    const somaVendas = (lista: typeof vendas) => round(lista.reduce((acc, v) => acc + Number(v.valor || 0), 0));

    const criadoEm = (row: unknown) => (row as { criado_em?: string | null }).criado_em;
    const vendasNovas = vendas
      .filter((v) => monthOfInstant(criadoEm(v)) === mes)
      .map((v) => {
        const totalParcelas = Number(v.total_parcelas) || 1;
        return {
          id: v.id!,
          cliente_nome: v.cliente?.nome ?? v.cliente_avulso ?? null,
          descricao: v.descricao ?? null,
          valor: Number(v.valor),
          valor_total: round(Number(v.valor_total) || Number(v.valor) * totalParcelas),
          total_parcelas: totalParcelas,
          criado_em: criadoEm(v) || '',
        };
      });

    const contasPagas = contas.filter((c) => c.pago && monthOfDate(c.data_pagamento) === mes);
    const contasEmAberto = contas.filter((c) => !c.pago && monthOfDate(c.data_vencimento) === mes);
    const somaContas = (lista: typeof contas) => round(lista.reduce((acc, c) => acc + Number(c.valor || 0), 0));

    const recebido = recebidoEm(mes);
    const pago = pagoEm(mes);

    return {
      mes,
      recebido: { total: recebido, quantidade: pagamentosDoMes.length },
      a_receber: { total: somaVendas(emAberto), quantidade: emAberto.length },
      vencido: { total: somaVendas(vencidas), quantidade: vencidas.length },
      vendas_novas: {
        quantidade: vendasNovas.length,
        valor_total: round(vendasNovas.reduce((acc, v) => acc + v.valor_total, 0)),
      },
      clientes_novos: clientes.filter((c) => monthOfInstant(criadoEm(c)) === mes).length,
      contas_pagas: { total: pago, quantidade: contasPagas.length },
      contas_em_aberto: { total: somaContas(contasEmAberto), quantidade: contasEmAberto.length },
      saldo: round(recebido - pago),
      avisos_enviados: avisosEnviados,
      avisos_enviados_hoje: avisosHoje,
      pagamentos: pagamentosDoMes,
      vendas: vendasNovas,
      contas: [...contasPagas, ...contasEmAberto].map((c) => ({
        id: c.id!,
        nome_credor: c.nome_credor,
        descricao: c.descricao ?? null,
        valor: Number(c.valor),
        data_vencimento: c.data_vencimento ?? null,
        pago: Boolean(c.pago),
        data_pagamento: c.data_pagamento ?? null,
      })),
      historico: meses.map((m) => {
        const r = recebidoEm(m);
        const p = pagoEm(m);
        return { mes: m, recebido: r, pago: p, saldo: round(r - p) };
      }),
    };
  }
}
