import { BackupSnapshot } from '../types/index.js';
import { formatBRL, formatDateBR, todayISO } from './format.js';
import { formatFullWhatsApp } from './phone.js';

type Row = Record<string, any>;

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileDate = (snapshot: BackupSnapshot) => todayISO(new Date(snapshot.gerado_em));

const dateTimeBR = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDateBR(todayISO(d))} ${hh}:${mm}`;
};

const STATUS_VENDA: Record<string, string> = {
  pendente: 'Pendente',
  avisado_3d: 'Avisado',
  avisado_1d: 'Avisado (véspera)',
  vencido: 'Vencido',
  pago: 'Pago',
};

/**
 * Arquivo completo (.json): é o que o sistema usa para restaurar os dados.
 */
export function downloadBackupJson(snapshot: BackupSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
  saveBlob(blob, `flowzap-backup-${fileDate(snapshot)}.json`);
}

/**
 * Relatório em PDF para leitura e impressão: clientes, vendas, pagamentos e contas a pagar.
 * As bibliotecas de PDF só são carregadas quando o botão é usado.
 */
export async function downloadBackupPdf(snapshot: BackupSnapshot): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const { clientes = [], vendas = [], historico_mensagens = [], contas_a_pagar = [] } = snapshot.tabelas as Record<
    string,
    Row[]
  >;
  const clientePorId = new Map<number, Row>(clientes.map((c) => [c.id, c]));
  const vendaPorId = new Map<number, Row>(vendas.map((v) => [v.id, v]));
  const nomeCliente = (id: number) => clientePorId.get(id)?.nome || `Cliente #${id}`;
  const pagamentos = historico_mensagens
    .filter((h) => h.tipo === 'confirmacao_manual')
    .sort((a, b) => String(b.data_envio).localeCompare(String(a.data_envio)));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('A&V Store - Backup dos dados', margin, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Gerado em ${dateTimeBR(snapshot.gerado_em)}`, margin, 22);
  doc.text(
    `${clientes.length} clientes  |  ${vendas.length} vendas  |  ${pagamentos.length} pagamentos recebidos  |  ${contas_a_pagar.length} contas a pagar`,
    margin,
    27
  );
  doc.setTextColor(0);

  let cursorY = 33;
  const section = (title: string, head: string[], body: string[][], empty: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    if (cursorY > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      cursorY = 16;
    }
    doc.text(title, margin, cursorY);

    autoTable(doc, {
      startY: cursorY + 3,
      head: [head],
      body: body.length > 0 ? body : [[{ content: empty, colSpan: head.length }]],
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
      headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    cursorY = ((doc as any).lastAutoTable?.finalY ?? cursorY) + 10;
  };

  section(
    'Clientes',
    ['Nome', 'WhatsApp', 'Situação', 'Observações'],
    [...clientes]
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
      .map((c) => [c.nome, formatFullWhatsApp(c.whatsapp || ''), c.ativo ? 'Ativo' : 'Inativo', c.observacoes || '']),
    'Nenhum cliente cadastrado.'
  );

  section(
    'Vendas',
    ['Cliente', 'Venda', 'Valor', 'Parcela', 'Total', 'Próx. vencimento', 'Status', 'Cobrança'],
    [...vendas]
      .sort((a, b) => nomeCliente(a.cliente_id).localeCompare(nomeCliente(b.cliente_id)))
      .map((v) => {
        const parcelado = Number(v.total_parcelas) > 1;
        return [
          nomeCliente(v.cliente_id),
          v.descricao || '',
          formatBRL(v.valor),
          parcelado ? `${v.parcela_atual || 1}/${v.total_parcelas}` : 'À vista',
          formatBRL(v.valor_total || Number(v.valor) * (Number(v.total_parcelas) || 1)),
          formatDateBR(v.data_vencimento_atual),
          STATUS_VENDA[v.status_mes_atual] || v.status_mes_atual,
          v.ativo ? 'Ativa' : 'Pausada/encerrada',
        ];
      }),
    'Nenhuma venda cadastrada.'
  );

  section(
    'Pagamentos recebidos',
    ['Pago em', 'Cliente', 'Venda', 'Parcela', 'Valor', 'Vencimento'],
    pagamentos.map((p) => {
      const venda = vendaPorId.get(p.venda_id);
      const d = p.detalhes || {};
      return [
        dateTimeBR(p.data_envio),
        venda ? nomeCliente(venda.cliente_id) : '-',
        venda?.descricao || `Venda #${p.venda_id}`,
        d.parcela && d.total_parcelas ? `${d.parcela}/${d.total_parcelas}` : '-',
        formatBRL(typeof d.valor === 'number' ? d.valor : venda?.valor),
        formatDateBR(d.vencimento),
      ];
    }),
    'Nenhum pagamento registrado.'
  );

  section(
    'Contas a pagar',
    ['Credor', 'Descrição', 'Valor', 'Vencimento', 'Situação', 'Observações'],
    contas_a_pagar.map((c) => [
      c.nome_credor,
      c.descricao || '',
      formatBRL(c.valor),
      formatDateBR(c.data_vencimento),
      c.pago ? `Pago${c.data_pagamento ? ` em ${formatDateBR(c.data_pagamento)}` : ''}` : 'Pendente',
      c.observacoes || '',
    ]),
    'Nenhuma conta cadastrada.'
  );

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    const y = doc.internal.pageSize.getHeight() - 6;
    doc.text('Este PDF é para consulta. Para restaurar o sistema, guarde também o arquivo de backup (.json).', margin, y);
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, y, { align: 'right' });
  }

  doc.save(`flowzap-backup-${fileDate(snapshot)}.pdf`);
}
