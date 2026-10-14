import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { ResumoMensal } from '../types/index.js';
import { api } from '../services/api.js';
import { extractErrorMessage } from '../utils/error.js';
import { formatBRL, formatDateBR, todayISO } from '../utils/format.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatTile } from '../components/ui/StatTile.js';
import { EmptyState } from '../components/ui/EmptyState.js';

type Lista = 'pagamentos' | 'vendas' | 'contas';

const mesAtual = () => todayISO().slice(0, 7);

const somarMeses = (mes: string, delta: number) => {
  const [ano, m] = mes.split('-').map(Number);
  const data = new Date(ano, m - 1 + delta, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
};

// "2026-10" -> "Outubro de 2026"
const nomeDoMes = (mes: string, curto = false) => {
  const [ano, m] = mes.split('-').map(Number);
  const texto = new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', {
    month: curto ? 'short' : 'long',
    year: curto ? '2-digit' : 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const dataLocal = (iso: string) => formatDateBR(todayISO(new Date(iso)));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Tudo o que aconteceu em um mês: recebido, a receber, vendas e clientes novos, contas e avisos.
 */
interface ResumoMensalViewProps {
  /** Muda quando uma venda ou um cliente é salvo fora desta tela: recarrega os dados. */
  refreshKey?: number;
}

export const ResumoMensalView: React.FC<ResumoMensalViewProps> = ({ refreshKey }) => {
  const [mes, setMes] = useState(mesAtual);
  const [resumo, setResumo] = useState<ResumoMensal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState<Lista>('pagamentos');

  const carregar = async (alvo: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/resumo/mensal', { params: { mes: alvo } });
      setResumo(res.data);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Não foi possível carregar o resumo do mês.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(mes);
  }, [mes, refreshKey]);

  const ehMesAtual = mes === mesAtual();
  // Enquanto o mês novo carrega, os números do mês anterior não ficam na tela
  const r = resumo && resumo.mes === mes ? resumo : null;
  const valor = (n?: number) => (r ? formatBRL(n) : '—');
  const numero = (n?: number) => (r ? n ?? 0 : '—');

  return (
    <div>
      <PageHeader
        title="Resumo mensal"
        subtitle="O que entrou, o que saiu e o que ficou em aberto em cada mês."
        actions={
          <>
            <div className="month-nav" role="group" aria-label="Escolher o mês">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setMes(somarMeses(mes, -1))}
                aria-label="Mês anterior"
                title="Mês anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="month-nav-label" aria-live="polite">
                {nomeDoMes(mes)}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setMes(somarMeses(mes, 1))}
                disabled={ehMesAtual}
                aria-label="Próximo mês"
                title={ehMesAtual ? 'Este já é o mês atual' : 'Próximo mês'}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {!ehMesAtual && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMes(mesAtual())}>
                Mês atual
              </button>
            )}

            <button className="btn btn-secondary btn-sm" onClick={() => carregar(mes)} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </>
        }
      />

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Dinheiro do mês */}
      <div className="grid-cards">
        <StatTile
          label="Recebido"
          value={valor(r?.recebido.total)}
          hint={r ? plural(r.recebido.quantidade, 'pagamento confirmado', 'pagamentos confirmados') : undefined}
          tone={r && r.recebido.quantidade > 0 ? 'success' : 'neutral'}
          onClick={() => setLista('pagamentos')}
        />
        <StatTile
          label="Ainda a receber"
          value={valor(r?.a_receber.total)}
          hint={
            r
              ? r.vencido.quantidade > 0
                ? `${formatBRL(r.vencido.total)} já venceu (${plural(r.vencido.quantidade, 'parcela', 'parcelas')})`
                : plural(r.a_receber.quantidade, 'parcela com vencimento no mês', 'parcelas com vencimento no mês')
              : undefined
          }
          tone={r && r.vencido.quantidade > 0 ? 'danger' : 'neutral'}
        />
        <StatTile
          label="Contas pagas"
          value={valor(r?.contas_pagas.total)}
          hint={
            r
              ? r.contas_em_aberto.quantidade > 0
                ? `${formatBRL(r.contas_em_aberto.total)} ainda em aberto`
                : plural(r.contas_pagas.quantidade, 'conta quitada', 'contas quitadas')
              : undefined
          }
          tone={r && r.contas_em_aberto.quantidade > 0 ? 'warning' : 'neutral'}
          onClick={() => setLista('contas')}
        />
        <StatTile
          label="Saldo do mês"
          value={valor(r?.saldo)}
          hint="Recebido menos contas pagas"
          tone={r ? (r.saldo > 0 ? 'success' : r.saldo < 0 ? 'danger' : 'neutral') : 'neutral'}
        />
      </div>

      {/* Movimento do mês */}
      <div className="grid-cards">
        <StatTile
          label="Vendas novas"
          value={numero(r?.vendas_novas.quantidade)}
          hint={r ? `${formatBRL(r.vendas_novas.valor_total)} vendidos` : undefined}
          onClick={() => setLista('vendas')}
        />
        <StatTile label="Clientes novos" value={numero(r?.clientes_novos)} hint="Cadastrados no mês" />
        <StatTile
          label="Contas em aberto"
          value={numero(r?.contas_em_aberto.quantidade)}
          hint={r ? `${formatBRL(r.contas_em_aberto.total)} com vencimento no mês` : undefined}
          tone={r && r.contas_em_aberto.quantidade > 0 ? 'warning' : 'neutral'}
          onClick={() => setLista('contas')}
        />
        <StatTile label="Avisos enviados" value={numero(r?.avisos_enviados)} hint="Mensagens de cobrança pelo WhatsApp" />
      </div>

      {/* Evolução */}
      <div className="excel-wrapper">
        <div className="excel-toolbar">
          <div className="panel-title">Últimos 6 meses</div>
          <div className="toolbar-meta">Toque em um mês para ver os detalhes dele.</div>
        </div>
        <div className="excel-table-container">
          <table className="excel-table table-compact">
            <thead>
              <tr>
                <th>Mês</th>
                <th className="num">Recebido</th>
                <th className="num">
                  <span className="label-long">Contas pagas</span>
                  <span className="label-short">Pago</span>
                </th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {!r ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState title={loading ? 'Carregando...' : 'Sem dados para mostrar'} />
                  </td>
                </tr>
              ) : (
                [...r.historico].reverse().map((h) => (
                  <tr
                    key={h.mes}
                    className={`row-clickable ${h.mes === mes ? 'is-current' : ''}`}
                    onClick={() => setMes(h.mes)}
                  >
                    <td className="cell-title">
                      <button type="button" className="link-btn row-link" onClick={() => setMes(h.mes)}>
                        <span className="label-long">{nomeDoMes(h.mes)}</span>
                        <span className="label-short">{nomeDoMes(h.mes, true)}</span>
                      </button>
                    </td>
                    <td className="num">{formatBRL(h.recebido)}</td>
                    <td className="num">{formatBRL(h.pago)}</td>
                    <td className="num cell-title">
                      <span className="saldo-cell">
                        {h.saldo !== 0 && (
                          <span className={`status-dot ${h.saldo > 0 ? 'dot-success' : 'dot-danger'}`} aria-hidden="true" />
                        )}
                        {formatBRL(h.saldo)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhes do mês */}
      <div className="excel-wrapper">
        <div className="excel-toolbar">
          <div className="excel-filters filters-fit" role="group" aria-label="Lista do mês">
            <button
              type="button"
              className={`excel-filter-btn ${lista === 'pagamentos' ? 'active' : ''}`}
              onClick={() => setLista('pagamentos')}
            >
              <span className="label-long">Pagamentos recebidos</span>
              <span className="label-short">Recebidos</span>
              <span className="excel-filter-count">{r?.pagamentos.length ?? 0}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${lista === 'vendas' ? 'active' : ''}`}
              onClick={() => setLista('vendas')}
            >
              <span className="label-long">Vendas novas</span>
              <span className="label-short">Vendas</span>
              <span className="excel-filter-count">{r?.vendas.length ?? 0}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${lista === 'contas' ? 'active' : ''}`}
              onClick={() => setLista('contas')}
            >
              <span className="label-long">Contas do mês</span>
              <span className="label-short">Contas</span>
              <span className="excel-filter-count">{r?.contas.length ?? 0}</span>
            </button>
          </div>
          <div className="toolbar-meta">{nomeDoMes(mes)}</div>
        </div>

        <div className="excel-table-container">
          {lista === 'pagamentos' && (
            <table className="excel-table stack-table">
              <thead>
                <tr>
                  <th>Pago em</th>
                  <th>Cliente</th>
                  <th>Venda</th>
                  <th style={{ textAlign: 'center' }}>Parcela</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {!r || r.pagamentos.length === 0 ? (
                  <tr className="is-plain">
                    <td colSpan={5} className="stack-full">
                      <EmptyState
                        title={!r ? 'Carregando...' : 'Nenhum pagamento recebido neste mês'}
                        text={r ? 'Os pagamentos aparecem aqui quando uma parcela é marcada como paga.' : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  r.pagamentos.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Pago em">{dataLocal(p.data_pagamento)}</td>
                      <td data-label="Cliente" className="cell-title">
                        {p.cliente_nome || 'Cliente desconhecido'}
                      </td>
                      <td data-label="Venda">{p.descricao || '-'}</td>
                      <td data-label="Parcela" style={{ textAlign: 'center' }}>
                        {p.parcela && p.total_parcelas ? `${p.parcela}/${p.total_parcelas}` : '-'}
                      </td>
                      <td data-label="Valor" className="num cell-title">
                        {formatBRL(p.valor)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {r && r.pagamentos.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      Total de {plural(r.pagamentos.length, 'pagamento', 'pagamentos')}
                    </td>
                    <td className="num">{formatBRL(r.recebido.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {lista === 'vendas' && (
            <table className="excel-table stack-table">
              <thead>
                <tr>
                  <th>Cadastrada em</th>
                  <th>Cliente</th>
                  <th>Venda</th>
                  <th style={{ textAlign: 'center' }}>Parcelas</th>
                  <th className="num">Parcela</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {!r || r.vendas.length === 0 ? (
                  <tr className="is-plain">
                    <td colSpan={6} className="stack-full">
                      <EmptyState title={!r ? 'Carregando...' : 'Nenhuma venda cadastrada neste mês'} />
                    </td>
                  </tr>
                ) : (
                  r.vendas.map((v) => (
                    <tr key={v.id}>
                      <td data-label="Cadastrada em">{dataLocal(v.criado_em)}</td>
                      <td data-label="Cliente" className="cell-title">
                        {v.cliente_nome || 'Cliente desconhecido'}
                      </td>
                      <td data-label="Venda">{v.descricao || '-'}</td>
                      <td data-label="Parcelas" style={{ textAlign: 'center' }}>
                        {v.total_parcelas > 1 ? `${v.total_parcelas}x` : 'À vista'}
                      </td>
                      <td data-label="Parcela" className="num">
                        {formatBRL(v.valor)}
                      </td>
                      <td data-label="Total" className="num cell-title">
                        {formatBRL(v.valor_total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {r && r.vendas.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      Total de {plural(r.vendas.length, 'venda', 'vendas')}
                    </td>
                    <td className="num">{formatBRL(r.vendas_novas.valor_total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {lista === 'contas' && (
            <table className="excel-table stack-table">
              <thead>
                <tr>
                  <th>Credor</th>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Situação</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {!r || r.contas.length === 0 ? (
                  <tr className="is-plain">
                    <td colSpan={5} className="stack-full">
                      <EmptyState
                        title={!r ? 'Carregando...' : 'Nenhuma conta neste mês'}
                        text={r ? 'Aparecem aqui as contas pagas no mês e as que vencem nele.' : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  r.contas.map((c) => (
                    <tr key={c.id}>
                      <td data-label="Credor" className="cell-title">
                        {c.nome_credor}
                      </td>
                      <td data-label="Descrição">{c.descricao || '-'}</td>
                      <td data-label="Vencimento">{formatDateBR(c.data_vencimento)}</td>
                      <td data-label="Situação">
                        {c.pago ? (
                          <span className="badge badge-pago">
                            <span className="status-dot dot-success" aria-hidden="true" />
                            Paga{c.data_pagamento ? ` em ${formatDateBR(c.data_pagamento)}` : ''}
                          </span>
                        ) : (
                          <span className="badge badge-avisado">
                            <span className="status-dot dot-warning" aria-hidden="true" />
                            Em aberto
                          </span>
                        )}
                      </td>
                      <td data-label="Valor" className="num cell-title">
                        {formatBRL(c.valor)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
