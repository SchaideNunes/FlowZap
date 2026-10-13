import { Cliente, Venda } from '../types/index.js';
import { normalizeSearch } from './format.js';

export type Urgencia = 'vencido' | 'hoje' | 'em_breve' | 'futuro' | 'nada';

export interface GrupoCliente {
  /** Estável entre recargas: mantém o cliente aberto depois de um pagamento. */
  key: string;
  nome: string;
  /** Nulo quando as vendas foram feitas sem cadastro (só o nome). */
  cliente: Cliente | null;
  vendas: Venda[];
  /** Parcelas que ainda precisam ser pagas (venda ativa e não paga). */
  abertas: Venda[];
  totalAberto: number;
  urgencia: Urgencia;
  /** Dias de atraso da parcela mais antiga (0 quando nada venceu). */
  diasAtraso: number;
  /** Dias até o próximo vencimento (só faz sentido sem atraso). */
  diasParaVencer: number | null;
  proximoVencimento: string | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Diferença em dias entre duas datas "YYYY-MM-DD" (positivo quando `ate` é depois de `de`). */
export function diasEntre(de: string, ate: string): number {
  const [y1, m1, d1] = de.split('-').map(Number);
  const [y2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DIA_MS);
}

export const vendaEmAberto = (v: Venda) => v.ativo && v.status_mes_atual !== 'pago';

/** Dias de atraso de uma parcela em aberto (0 se ainda não venceu). */
export function atrasoDaVenda(v: Venda, hoje: string): number {
  if (!vendaEmAberto(v) || !v.data_vencimento_atual) return 0;
  return Math.max(0, diasEntre(v.data_vencimento_atual, hoje));
}

/**
 * Junta as vendas por cliente. Entram todos os clientes cadastrados (mesmo sem venda) e,
 * para as vendas sem cadastro, um grupo por nome digitado.
 */
export function agruparPorCliente(clientes: Cliente[], vendas: Venda[], hoje: string): GrupoCliente[] {
  const porChave = new Map<string, { nome: string; cliente: Cliente | null; vendas: Venda[] }>();

  for (const cliente of clientes) {
    porChave.set(`c:${cliente.id}`, { nome: cliente.nome, cliente, vendas: [] });
  }

  for (const venda of vendas) {
    const key = venda.cliente_id
      ? `c:${venda.cliente_id}`
      : `a:${normalizeSearch(venda.cliente_avulso) || `venda-${venda.id}`}`;
    let grupo = porChave.get(key);
    if (!grupo) {
      // Cliente que veio só junto da venda, ou venda sem cadastro
      grupo = {
        nome: venda.cliente?.nome || venda.cliente_avulso || 'Cliente desconhecido',
        cliente: venda.cliente || null,
        vendas: [],
      };
      porChave.set(key, grupo);
    }
    grupo.vendas.push(venda);
  }

  return Array.from(porChave, ([key, grupo]) => {
    // O que ainda precisa ser pago vem primeiro; vendas pausadas ou quitadas ficam no fim
    const ordenadas = [...grupo.vendas].sort(
      (a, b) =>
        Number(vendaEmAberto(b)) - Number(vendaEmAberto(a)) ||
        (a.data_vencimento_atual || '').localeCompare(b.data_vencimento_atual || '')
    );
    const abertas = ordenadas.filter(vendaEmAberto);
    const proximoVencimento = abertas[0]?.data_vencimento_atual || null;
    const diasAtraso = abertas.reduce((max, v) => Math.max(max, atrasoDaVenda(v, hoje)), 0);
    const diasParaVencer = proximoVencimento ? diasEntre(hoje, proximoVencimento) : null;

    let urgencia: Urgencia = 'nada';
    if (abertas.length > 0) {
      if (diasAtraso > 0) urgencia = 'vencido';
      else if (diasParaVencer === 0) urgencia = 'hoje';
      else if (diasParaVencer !== null && diasParaVencer <= 3) urgencia = 'em_breve';
      else urgencia = 'futuro';
    }

    return {
      key,
      nome: grupo.nome,
      cliente: grupo.cliente,
      vendas: ordenadas,
      abertas,
      totalAberto: abertas.reduce((acc, v) => acc + (Number(v.valor) || 0), 0),
      urgencia,
      diasAtraso,
      diasParaVencer,
      proximoVencimento,
    };
  });
}

const PESO: Record<Urgencia, number> = { vencido: 0, hoje: 1, em_breve: 2, futuro: 3, nada: 4 };

/** Quem cobrar primeiro: mais dias de atraso no topo, depois o vencimento mais próximo. */
export function ordenarPorUrgencia(a: GrupoCliente, b: GrupoCliente): number {
  if (PESO[a.urgencia] !== PESO[b.urgencia]) return PESO[a.urgencia] - PESO[b.urgencia];
  if (a.urgencia === 'vencido' && a.diasAtraso !== b.diasAtraso) return b.diasAtraso - a.diasAtraso;
  const venc = (a.proximoVencimento || '9999').localeCompare(b.proximoVencimento || '9999');
  return venc !== 0 ? venc : a.nome.localeCompare(b.nome);
}

/** Situação do cliente em palavras. */
export function textoDaUrgencia(grupo: GrupoCliente): string {
  switch (grupo.urgencia) {
    case 'vencido':
      return `Vencido há ${grupo.diasAtraso} ${grupo.diasAtraso === 1 ? 'dia' : 'dias'}`;
    case 'hoje':
      return 'Vence hoje';
    case 'em_breve':
      return grupo.diasParaVencer === 1 ? 'Vence amanhã' : `Vence em ${grupo.diasParaVencer} dias`;
    case 'futuro': {
      const [, mes, dia] = (grupo.proximoVencimento || '').split('-');
      return `Vence em ${dia}/${mes}`;
    }
    default:
      return grupo.vendas.length === 0 ? 'Sem vendas' : 'Nada a receber';
  }
}
