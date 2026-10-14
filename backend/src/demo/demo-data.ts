import bcrypt from 'bcryptjs';
import { createEmptyStore, MemoryStore, VendaRow } from './memory.repositories.js';
import { TipoMensagem } from '../repositories/historico.repository.interface.js';
import { VendaStatus } from '../schemas/venda.schema.js';

/** Login da demonstração. Só existe na memória do servidor de demonstração. */
export const DEMO_LOGIN = { email: 'demo@flowzap.dev', senha: 'demo1234' } as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const BRASIL_OFFSET_HOURS = 3;

interface VendaDemo {
  cliente?: number;
  avulso?: string;
  descricao: string;
  valor: number;
  parcelas?: number;
  /** Parcela atual; as anteriores entram como pagas, uma por mês. */
  parcela: number;
  /** Vencimento atual, em dias a partir de hoje (negativo = vencida). */
  vence: number;
  status?: VendaStatus;
  ativo?: boolean;
  observacoes?: string;
  /** Avisos do ciclo atual que já saíram. */
  avisos?: boolean;
}

/**
 * Uma loja fictícia de celulares, montada em volta do dia de hoje: há clientes em atraso, um
 * vencimento hoje, avisos enviados, seis meses de pagamentos e contas a pagar. Nomes e telefones
 * são inventados (todos os números seguem o padrão 55 11 90000-01xx).
 */
export async function createDemoStore(now: Date = new Date()): Promise<MemoryStore> {
  const store = createEmptyStore();
  const nowMs = now.getTime();
  const br = new Date(nowMs - BRASIL_OFFSET_HOURS * HOUR_MS);
  const todayMs = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate());

  const day = (offset: number) => new Date(todayMs + offset * DAY_MS).toISOString().slice(0, 10);
  const offsetOf = (iso: string) => Math.round((Date.parse(iso) - todayMs) / DAY_MS);
  /** Instante de "offset dias a partir de hoje, às h:m no Brasil", nunca depois de agora. */
  const at = (offset: number, h: number, m = 0) =>
    new Date(Math.min(todayMs + offset * DAY_MS + (h + BRASIL_OFFSET_HOURS) * HOUR_MS + m * 60000, nowMs - 60000)).toISOString();
  const addMonths = (iso: string, n: number) => {
    const [y, mo, d] = iso.split('-').map(Number);
    const ultimo = new Date(Date.UTC(y, mo - 1 + n + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, mo - 1 + n, Math.min(d, ultimo))).toISOString().slice(0, 10);
  };

  const historico = (venda_id: number, tipo: TipoMensagem, data_envio: string, mensagem: string | null = null, detalhes: Record<string, unknown> | null = null) =>
    store.historico.push({ id: store.historico.length + 1, venda_id, tipo, data_envio, status_envio: 'enviado', mensagem, detalhes });

  const cliente = (nome: string, cadastradoHa: number) => {
    const id = store.clientes.length + 1;
    store.clientes.push({
      id,
      nome,
      whatsapp: `55119000001${String(id).padStart(2, '0')}`,
      ativo: true,
      observacoes: null,
      criado_em: at(-cadastradoHa, 14),
    });
    return id;
  };

  const venda = (o: VendaDemo): VendaRow => {
    const id = store.vendas.length + 1;
    const vencimento = day(o.vence);
    const total = o.parcelas ?? null;
    const primeiroVencimento = addMonths(vencimento, -(o.parcela - 1));
    const row: VendaRow = {
      id,
      cliente_id: o.cliente ?? null,
      cliente_avulso: o.avulso ?? null,
      descricao: o.descricao,
      valor: o.valor,
      dia_vencimento: Number(vencimento.slice(8)),
      valor_total: total ? Math.round(o.valor * total * 100) / 100 : null,
      taxa_juros: null,
      total_parcelas: total,
      parcela_atual: o.parcela,
      status_mes_atual: o.status ?? 'pendente',
      data_vencimento_atual: vencimento,
      ativo: o.ativo ?? true,
      observacoes: o.observacoes ?? null,
      criado_em: at(offsetOf(primeiroVencimento) - 20, 15, 20),
    };
    store.vendas.push(row);

    // Parcelas anteriores pagas perto do vencimento de cada mês
    for (let k = 1; k < o.parcela; k++) {
      const venc = addMonths(primeiroVencimento, k - 1);
      const pagoEm = Math.min(offsetOf(venc) + ((id + k) % 3) - 1, -1);
      historico(id, 'confirmacao_manual', at(pagoEm, 10 + ((id * 3 + k) % 8), (id * 7) % 60), 'Pagamento confirmado manualmente', {
        valor: o.valor,
        vencimento: venc,
        parcela: total ? k : null,
        total_parcelas: total,
        status: 'avisado_1d',
      });
    }

    // Avisos do ciclo atual que já deveriam ter saído (um por dia, às 09h)
    if (o.avisos) {
      const janela: Array<[TipoMensagem, number]> = [
        ['lembrete_3d', o.vence - 3],
        ['lembrete_2d', o.vence - 2],
        ['lembrete_1d', o.vence - 1],
        ['vencido', o.vence],
      ];
      for (const [tipo, dia] of janela) if (dia <= 0) historico(id, tipo, at(dia, 9, 2 + (id % 9)));
    }
    return row;
  };

  // ---------- clientes e vendas ----------
  venda({ cliente: cliente('Ana Paula Ribeiro', 260), descricao: 'iPhone 13 128GB', valor: 389.9, parcelas: 10, parcela: 5, vence: -6, status: 'vencido', avisos: true });
  venda({ cliente: cliente('Bruno Carvalho', 230), descricao: 'Galaxy A55 256GB', valor: 199.9, parcelas: 12, parcela: 7, vence: -2, status: 'vencido', avisos: true });
  venda({
    cliente: cliente('Patrícia Gomes', 300),
    descricao: 'iPhone 12 64GB (seminovo)',
    valor: 329.9,
    parcelas: 10,
    parcela: 8,
    vence: -15,
    status: 'vencido',
    avisos: true,
    observacoes: 'Combinou de pagar duas parcelas juntas no dia 20.',
  });
  venda({ cliente: cliente('Camila Duarte', 120), descricao: 'Redmi Note 13 Pro', valor: 249, parcelas: 6, parcela: 3, vence: 0, status: 'vencido', avisos: true });
  venda({ cliente: cliente('Diego Martins', 95), descricao: 'Moto G84 5G', valor: 159.9, parcelas: 10, parcela: 3, vence: 1, status: 'avisado_1d', avisos: true });
  venda({ cliente: cliente('Eduarda Lima', 170), descricao: 'iPhone 11 128GB (seminovo)', valor: 287.5, parcelas: 8, parcela: 5, vence: 2, status: 'avisado_3d', avisos: true });
  const felipe = cliente('Felipe Andrade', 280);
  // Cadastrada depois da rotina de hoje: o aviso de 3 dias ainda vai sair
  venda({ cliente: felipe, descricao: 'Galaxy S23 FE', valor: 279.9, parcelas: 12, parcela: 9, vence: 3 });
  venda({ cliente: felipe, descricao: 'Plano de proteção (mensal)', valor: 39.9, parcela: 6, vence: 17 });
  venda({ cliente: cliente('Gabriela Rocha', 60), descricao: 'AirPods (3ª geração)', valor: 249.8, parcelas: 5, parcela: 2, vence: 3, status: 'avisado_3d', avisos: true });
  venda({ cliente: cliente('Henrique Souza', 40), descricao: 'Troca de tela iPhone 12', valor: 180, parcelas: 3, parcela: 2, vence: 19 });
  venda({ cliente: cliente('Isabela Freitas', 200), descricao: 'Galaxy A35 128GB', valor: 169.9, parcelas: 10, parcela: 6, vence: 18 });
  venda({ cliente: cliente('João Pedro Alves', 75), descricao: 'iPhone 14 128GB', valor: 459.9, parcelas: 12, parcela: 3, vence: 20, observacoes: 'Entrada de R$ 800 paga em dinheiro.' });
  venda({ cliente: cliente('Larissa Mendes', 150), descricao: 'Redmi 13C', valor: 199.75, parcelas: 4, parcela: 4, vence: 9 });
  venda({ cliente: cliente('Marcos Vinícius Teixeira', 12), descricao: 'Motorola Edge 50', valor: 299, parcelas: 10, parcela: 1, vence: 24 });
  const quitada = venda({ cliente: cliente('Natália Barros', 240), descricao: 'Galaxy A15', valor: 149.9, parcelas: 6, parcela: 6, vence: -20, status: 'pago', ativo: false });
  historico(quitada.id, 'confirmacao_manual', at(-19, 16, 40), 'Venda totalmente quitada! Todas as 6 parcelas foram pagas.', {
    valor: 149.9,
    vencimento: day(-20),
    parcela: 6,
    total_parcelas: 6,
    status: 'avisado_1d',
  });
  venda({ cliente: cliente('Rafael Moreira', 8), descricao: 'Xiaomi 14T 512GB', valor: 389, parcelas: 12, parcela: 1, vence: 5 });
  cliente('Sabrina Costa', 5);
  venda({ cliente: cliente('Vanessa Pires', 130), descricao: 'iPhone 15 128GB', valor: 459.9, parcelas: 12, parcela: 4, vence: 21 });
  venda({ cliente: cliente('Lucas Ferreira', 100), descricao: 'Galaxy S24 256GB', valor: 399.9, parcelas: 10, parcela: 3, vence: 23 });
  venda({ cliente: cliente('Mariana Castro', 45), descricao: 'Reparo de placa Galaxy S21', valor: 220, parcelas: 2, parcela: 2, vence: 19 });
  venda({ cliente: cliente('Thiago Ramos', 210), descricao: 'Galaxy A55 128GB', valor: 274.9, parcelas: 8, parcela: 6, vence: 22 });
  venda({ avulso: 'Roberto Lins', descricao: 'Carregador turbo + fone', valor: 89.9, parcelas: 2, parcela: 1, vence: 6 });

  // ---------- contas a pagar da loja ----------
  const conta = (nome_credor: string, descricao: string, valor: number, vence: number, pagaEm?: number) =>
    store.contas.push({
      id: store.contas.length + 1,
      nome_credor,
      descricao,
      valor,
      data_vencimento: day(vence),
      pago: pagaEm !== undefined,
      data_pagamento: pagaEm !== undefined ? day(pagaEm) : null,
      observacoes: null,
      criado_em: at(Math.min(vence - 20, 0), 11),
      atualizado_em: at(Math.min(vence - 20, 0), 11),
    });
  for (let m = 5; m >= 1; m--) {
    const inicio = offsetOf(addMonths(day(0), -m));
    conta('Aluguel da loja', 'Aluguel', 1200, inicio - 4, inicio - 5);
    conta('Distribuidora Cell Peças', 'Telas e baterias', 480 + m * 62.5, inicio + 3, inicio + 2);
  }
  conta('Aluguel da loja', 'Aluguel', 1200, -4, -5);
  conta('Contabilidade Silva', 'Honorários do mês', 450, 1);
  conta('Companhia de energia', 'Conta de luz', 412.37, -1);
  conta('Distribuidora Cell Peças', 'Lote de telas e baterias', 980, 4);
  conta('Provedor de internet', 'Internet e telefone', 129.9, 6);
  conta('Acessórios Brasil', 'Capinhas e películas', 760, 16);

  // ---------- configuração, sede e login ----------
  store.configuracao = { envio_automatico: true, mensagens: {}, chave_pix: '12.345.678/0001-90' };
  store.sede = {
    estado_whatsapp: 'open',
    atualizado_em: now.toISOString(),
    ultima_rotina_data: day(0),
    ultimo_backup_em: at(0, 9),
    sede_id: null,
    sede_nome: 'Computador da loja',
  };
  store.usuarios.push({
    id: 'demo-1',
    nome: 'Demonstração',
    email: DEMO_LOGIN.email,
    senha_hash: await bcrypt.hash(DEMO_LOGIN.senha, 10),
    ativo: true,
  });

  return store;
}
