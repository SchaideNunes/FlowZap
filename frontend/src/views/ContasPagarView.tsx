import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, CheckCircle2, Edit2, Check, X, Trash2, Calendar, RefreshCw, Undo2 } from 'lucide-react';
import { ContaPagar } from '../types/index.js';
import { api } from '../services/api.js';
import { ContaPagarModal } from '../components/ContaPagarModal.js';
import { extractErrorMessage } from '../utils/error.js';
import { formatBRL, formatDateBR, todayISO } from '../utils/format.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatTile } from '../components/ui/StatTile.js';
import { EmptyState } from '../components/ui/EmptyState.js';

type StatusFilter = 'todos' | 'pendente' | 'vencido' | 'pago';

export const ContasPagarView: React.FC = () => {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [payingContaId, setPayingContaId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contaToEdit, setContaToEdit] = useState<ContaPagar | null>(null);

  const fetchContas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/contas-pagar');
      setContas(res.data || []);
    } catch {
      // Ignora erro passageiro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContas();
  }, []);

  const handleTogglePaga = async (conta: ContaPagar) => {
    const novoStatus = !conta.pago;
    setPayingContaId(conta.id);
    try {
      await api.put(`/contas-pagar/${conta.id}`, {
        pago: novoStatus,
        data_pagamento: novoStatus ? todayISO() : null,
      });
      setFeedbackMsg(
        novoStatus
          ? `Conta de "${conta.nome_credor}" marcada como paga.`
          : `Conta de "${conta.nome_credor}" reaberta como pendente.`
      );
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchContas();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Erro ao atualizar conta a pagar.'));
    } finally {
      setPayingContaId(null);
    }
  };

  const handleDelete = async (conta: ContaPagar) => {
    const confirm = window.confirm(
      `Excluir a conta de "${conta.nome_credor}" no valor de ${formatBRL(conta.valor)}?`
    );
    if (!confirm) return;

    try {
      await api.delete(`/contas-pagar/${conta.id}`);
      setFeedbackMsg(`Conta de "${conta.nome_credor}" excluída.`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchContas();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Erro ao excluir conta a pagar.'));
    }
  };

  const openNovaConta = () => {
    setContaToEdit(null);
    setIsModalOpen(true);
  };

  const openEditarConta = (conta: ContaPagar) => {
    setContaToEdit(conta);
    setIsModalOpen(true);
  };

  // Vencida: não paga e com vencimento anterior a hoje (data local)
  const hoje = todayISO();
  const isContaVencida = (c: ContaPagar) =>
    !c.pago && Boolean(c.data_vencimento) && c.data_vencimento!.split('T')[0] < hoje;

  const filteredContas = useMemo(() => {
    return contas.filter((c) => {
      const term = search.toLowerCase().trim();
      if (term) {
        const matchNome = c.nome_credor.toLowerCase().includes(term);
        const matchDesc = (c.descricao || '').toLowerCase().includes(term);
        if (!matchNome && !matchDesc) return false;
      }

      if (statusFilter === 'pendente') return !c.pago;
      if (statusFilter === 'pago') return c.pago;
      if (statusFilter === 'vencido') return isContaVencida(c);

      return true;
    });
  }, [contas, search, statusFilter, hoje]);

  const totals = useMemo(() => {
    const pendentes = contas.filter((c) => !c.pago);
    const pagas = contas.filter((c) => c.pago);

    return {
      totalPendente: pendentes.reduce((sum, c) => sum + (Number(c.valor) || 0), 0),
      totalPago: pagas.reduce((sum, c) => sum + (Number(c.valor) || 0), 0),
      countPendentes: pendentes.length,
      countPagos: pagas.length,
      countVencidas: contas.filter(isContaVencida).length,
      totalRegistros: contas.length,
    };
  }, [contas, hoje]);

  const totalFiltradoPendente = filteredContas
    .filter((c) => !c.pago)
    .reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  const totalFiltradoPago = filteredContas
    .filter((c) => c.pago)
    .reduce((acc, c) => acc + (Number(c.valor) || 0), 0);

  const getStatusBadge = (c: ContaPagar) => {
    if (c.pago) {
      return (
        <span className="badge badge-pago">
          <span className="status-dot dot-success" aria-hidden="true" />
          Paga
        </span>
      );
    }
    if (isContaVencida(c)) {
      return (
        <span className="badge badge-vencido">
          <span className="status-dot dot-danger" aria-hidden="true" />
          Vencida
        </span>
      );
    }
    return (
      <span className="badge badge-avisado">
        <span className="status-dot dot-warning" aria-hidden="true" />
        A pagar
      </span>
    );
  };

  const emptyState = (
    <EmptyState
      title="Nenhuma conta encontrada"
      text="Ajuste a busca ou os filtros, ou cadastre uma nova conta a pagar."
      action={
        <button className="btn btn-primary btn-sm" onClick={openNovaConta}>
          <Plus size={14} /> Nova conta
        </button>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Quem devemos"
        subtitle="Contas a pagar a fornecedores e credores."
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={fetchContas} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button className="btn btn-primary btn-sm" onClick={openNovaConta}>
              <Plus size={15} />
              Nova conta
            </button>
          </>
        }
      />

      {feedbackMsg && (
        <div className="alert alert-success" role="status">
          <CheckCircle2 size={18} />
          {feedbackMsg}
        </div>
      )}

      {/* Indicadores (clicáveis: filtram a lista) */}
      <div className="grid-cards">
        <StatTile
          label="A pagar"
          value={formatBRL(totals.totalPendente)}
          hint={`${totals.countPendentes} ${totals.countPendentes === 1 ? 'conta em aberto' : 'contas em aberto'}`}
          onClick={() => setStatusFilter('pendente')}
        />
        <StatTile
          label="Vencidas"
          value={totals.countVencidas}
          hint={totals.countVencidas > 0 ? 'Ver quais' : 'Nenhuma conta atrasada'}
          tone={totals.countVencidas > 0 ? 'danger' : 'neutral'}
          onClick={() => setStatusFilter('vencido')}
        />
        <StatTile
          label="Quitado"
          value={formatBRL(totals.totalPago)}
          hint={`${totals.countPagos} ${totals.countPagos === 1 ? 'conta paga' : 'contas pagas'}`}
          tone={totals.countPagos > 0 ? 'success' : 'neutral'}
          onClick={() => setStatusFilter('pago')}
        />
        <StatTile
          label="Lançamentos"
          value={totals.totalRegistros}
          hint="Total cadastrado"
          onClick={() => setStatusFilter('todos')}
        />
      </div>

      <div className="excel-wrapper">
        <div className="excel-toolbar">
          <div className="excel-search-box">
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar credor ou descrição"
              aria-label="Buscar credor ou descrição"
              style={{ paddingLeft: '2.3rem', paddingRight: search ? '2.2rem' : undefined }}
            />
            <Search
              size={15}
              color="var(--text-dim)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            {search && (
              <button
                type="button"
                className="icon-btn-inline"
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}
                title="Limpar busca"
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="excel-filters">
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'todos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('todos')}
            >
              <span>Todas</span>
              <span className="excel-filter-count">{totals.totalRegistros}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'pendente' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pendente')}
            >
              <span>A pagar</span>
              <span className="excel-filter-count">{totals.countPendentes}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'vencido' ? 'active' : ''}`}
              onClick={() => setStatusFilter('vencido')}
            >
              <span>Vencidas</span>
              <span className={`excel-filter-count ${totals.countVencidas > 0 ? 'has-alert' : ''}`}>
                {totals.countVencidas}
              </span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'pago' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pago')}
            >
              <span>Pagas</span>
              <span className="excel-filter-count">{totals.countPagos}</span>
            </button>
          </div>
        </div>

        {/* Planilha (computador e tablet) */}
        <div className="excel-table-container desktop-table-view">
          <table className="excel-table">
            <thead>
              <tr>
                <th>Credor</th>
                <th>Descrição</th>
                <th>Vencimento</th>
                <th className="num">Valor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="Carregando contas..." />
                  </td>
                </tr>
              ) : filteredContas.length === 0 ? (
                <tr>
                  <td colSpan={6}>{emptyState}</td>
                </tr>
              ) : (
                filteredContas.map((c) => {
                  const isVencido = isContaVencida(c);

                  return (
                    <tr key={c.id} className={isVencido ? 'row-vencido' : ''} style={{ opacity: c.pago ? 0.6 : 1 }}>
                      <td>
                        <span className="cell-title">{c.nome_credor}</span>
                        {c.observacoes && <span className="cell-sub">{c.observacoes}</span>}
                      </td>

                      <td>{c.descricao || <span style={{ color: 'var(--text-dim)' }}>-</span>}</td>

                      <td>
                        {c.data_vencimento ? (
                          <span className={`date-cell ${isVencido ? 'is-overdue' : ''}`}>
                            <Calendar size={13} />
                            {formatDateBR(c.data_vencimento)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>Sem data</span>
                        )}
                      </td>

                      <td className="num cell-title">{formatBRL(c.valor)}</td>

                      <td>{getStatusBadge(c)}</td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="cell-actions">
                          {c.pago ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleTogglePaga(c)}
                              disabled={payingContaId === c.id}
                              title="Voltar esta conta para pendente"
                            >
                              <Undo2 size={14} />
                              Desfazer
                            </button>
                          ) : (
                            <button
                              className="btn btn-pay btn-sm"
                              onClick={() => handleTogglePaga(c)}
                              disabled={payingContaId === c.id}
                              title="Registrar que esta conta foi paga"
                            >
                              <Check size={14} />
                              {payingContaId === c.id ? 'Salvando...' : 'Marcar paga'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => openEditarConta(c)}
                            title="Editar conta"
                            aria-label="Editar conta"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => handleDelete(c)}
                            title="Excluir conta"
                            aria-label="Excluir conta"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {filteredContas.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                    Total a pagar
                  </td>
                  <td className="num">{formatBRL(totalFiltradoPendente)}</td>
                  <td colSpan={2} style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                    Quitado: {formatBRL(totalFiltradoPago)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Cartões (celular) */}
        <div className="mobile-cards-view">
          {loading ? (
            <EmptyState title="Carregando contas..." />
          ) : filteredContas.length === 0 ? (
            emptyState
          ) : (
            <>
              {filteredContas.map((c) => {
                const isVencido = isContaVencida(c);

                return (
                  <div
                    key={c.id}
                    className={`mobile-record-card ${c.pago ? 'card-pago' : isVencido ? 'card-vencido' : ''}`}
                    style={{ opacity: c.pago ? 0.7 : 1 }}
                  >
                    <div className="mobile-card-header">
                      <div style={{ minWidth: 0 }}>
                        <span className="mobile-card-name">{c.nome_credor}</span>
                        <div className="list-row-sub">{c.descricao || 'Sem descrição'}</div>
                      </div>
                      {getStatusBadge(c)}
                    </div>

                    <div className="mobile-card-body">
                      <div className="mobile-card-finance-row">
                        <div>
                          <div className="mobile-card-val-label">Valor</div>
                          <div className="mobile-card-val-main">{formatBRL(c.valor)}</div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div className="mobile-card-val-label">Vencimento</div>
                          {c.data_vencimento ? (
                            <span className={`date-cell ${isVencido ? 'is-overdue' : ''}`}>
                              <Calendar size={13} />
                              {formatDateBR(c.data_vencimento)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>Sem data</span>
                          )}
                        </div>
                      </div>

                      {c.observacoes && <div className="mobile-card-meta-grid">{c.observacoes}</div>}
                    </div>

                    <div className="mobile-card-actions">
                      {c.pago ? (
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1 }}
                          onClick={() => handleTogglePaga(c)}
                          disabled={payingContaId === c.id}
                        >
                          <Undo2 size={16} />
                          Desfazer pagamento
                        </button>
                      ) : (
                        <button
                          className="btn btn-pay"
                          style={{ flex: 1 }}
                          onClick={() => handleTogglePaga(c)}
                          disabled={payingContaId === c.id}
                        >
                          <Check size={16} />
                          {payingContaId === c.id ? 'Salvando...' : 'Marcar paga'}
                        </button>
                      )}

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => openEditarConta(c)}
                          title="Editar conta"
                          aria-label="Editar conta"
                        >
                          <Edit2 size={16} />
                        </button>

                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => handleDelete(c)}
                          title="Excluir conta"
                          aria-label="Excluir conta"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="mobile-summary-footer">
                <div>
                  <div className="mobile-card-val-label">Total a pagar</div>
                  <div className="figure-value">{formatBRL(totalFiltradoPendente)}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="mobile-card-val-label">Quitado</div>
                  <div style={{ fontWeight: 600 }}>{formatBRL(totalFiltradoPago)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ContaPagarModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setContaToEdit(null);
        }}
        contaToEdit={contaToEdit}
        onSuccess={fetchContas}
      />
    </div>
  );
};
