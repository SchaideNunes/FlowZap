import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  CheckCircle2,
  Edit2,
  Table,
  Check,
  X,
  Trash2,
  Calendar,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { ContaPagar } from '../types/index.js';
import { api } from '../services/api.js';
import { ContaPagarModal } from '../components/ContaPagarModal.js';

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
        data_pagamento: novoStatus ? new Date().toISOString().split('T')[0] : null,
      });
      setFeedbackMsg(
        novoStatus
          ? `Débito com "${conta.nome_credor}" marcado como PAGO!`
          : `Débito com "${conta.nome_credor}" reaberto como PENDENTE.`
      );
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchContas();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao atualizar conta a pagar.');
    } finally {
      setPayingContaId(null);
    }
  };

  const handleDelete = async (conta: ContaPagar) => {
    const confirm = window.confirm(
      `Excluir o registro de débito com "${conta.nome_credor}" no valor de R$ ${Number(conta.valor)
        .toFixed(2)
        .replace('.', ',')}?`
    );
    if (!confirm) return;

    try {
      await api.delete(`/contas-pagar/${conta.id}`);
      setFeedbackMsg(`Registro "${conta.nome_credor}" excluído.`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchContas();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir conta a pagar.');
    }
  };

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
      if (statusFilter === 'vencido') {
        if (c.pago) return false;
        if (!c.data_vencimento) return false;
        return c.data_vencimento < new Date().toISOString().split('T')[0];
      }

      return true;
    });
  }, [contas, search, statusFilter]);

  const totals = useMemo(() => {
    const totalPendente = contas
      .filter((c) => !c.pago)
      .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

    const totalPago = contas
      .filter((c) => c.pago)
      .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

    const countPendentes = contas.filter((c) => !c.pago).length;
    const countPagos = contas.filter((c) => c.pago).length;

    return {
      totalPendente,
      totalPago,
      countPendentes,
      countPagos,
      totalRegistros: contas.length,
    };
  }, [contas]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={20} color="#f87171" />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Quem Devemos (Contas a Pagar)
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '4px' }}>
            Controle financeiro de fornecedores, credores e parcelamentos a quitar da loja.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchContas} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              setContaToEdit(null);
              setIsModalOpen(true);
            }}
            style={{
              padding: '0.55rem 1.25rem',
              fontWeight: 600,
            }}
          >
            <PlusCircle size={16} /> + Novo Credor / Dívida
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid var(--primary)',
            color: '#34d399',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
          }}
        >
          <CheckCircle2 size={19} />
          {feedbackMsg}
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
        {/* CARD 1: VALOR TOTAL QUE DEVEMOS */}
        <div
          className="card stat-card"
          style={{
            padding: '1.25rem',
            borderLeft: '3px solid #f43f5e',
          }}
        >
          <div className="stat-info">
            <span className="stat-label" style={{ color: '#fb7185', fontWeight: 700 }}>
              VALOR TOTAL QUE DEVEMOS
            </span>
            <span
              className="stat-value"
              style={{
                color: '#fb7185',
                fontSize: '1.65rem',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              R$ {totals.totalPendente.toFixed(2).replace('.', ',')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {totals.countPendentes} dívidas / parcelas em aberto
            </span>
          </div>
          <div
            className="stat-icon"
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
            }}
          >
            <Building2 size={22} color="#f43f5e" />
          </div>
        </div>

        {/* CARD 2: TOTAL JÁ QUITADO */}
        <div
          className="card stat-card"
          style={{
            padding: '1.25rem',
            borderLeft: '3px solid #10b981',
          }}
        >
          <div className="stat-info">
            <span className="stat-label" style={{ color: '#6ee7b7' }}>
              TOTAL JÁ QUITADO (PAGO)
            </span>
            <span
              className="stat-value"
              style={{
                color: '#34d399',
                fontSize: '1.65rem',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              R$ {totals.totalPago.toFixed(2).replace('.', ',')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {totals.countPagos} registros liquidados
            </span>
          </div>
          <div
            className="stat-icon"
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <CheckCircle2 size={22} color="#10b981" />
          </div>
        </div>

        {/* CARD 3: TOTAL DE REGISTROS */}
        <div
          className="card stat-card"
          style={{
            padding: '1.25rem',
            borderLeft: '3px solid #8b5cf6',
          }}
        >
          <div className="stat-info">
            <span className="stat-label">BASE DE CREDORES</span>
            <span className="stat-value" style={{ fontSize: '1.65rem' }}>
              {totals.totalRegistros}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Total de lançamentos cadastrados
            </span>
          </div>
          <div
            className="stat-icon"
            style={{
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
            }}
          >
            <Table size={22} color="#a78bfa" />
          </div>
        </div>
      </div>

      {/* Planilha Excel de Quem Devemos */}
      <div className="excel-wrapper">
        <div className="excel-toolbar">
          {/* Campo de Busca */}
          <div className="excel-search-box">
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar credor, fornecedor ou motivo..."
              style={{
                paddingLeft: '2.3rem',
                paddingRight: search ? '2rem' : '0.8rem',
                fontSize: '0.84rem',
                height: '38px',
                borderRadius: '8px',
              }}
            />
            <Search
              size={15}
              color="var(--text-dim)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtros de Status */}
          <div className="excel-filters">
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'todos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('todos')}
            >
              <span>Todos</span>
              <span className="excel-filter-count">{totals.totalRegistros}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'pendente' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pendente')}
            >
              <span>A Pagar</span>
              <span className="excel-filter-count">{totals.countPendentes}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'vencido' ? 'active' : ''}`}
              onClick={() => setStatusFilter('vencido')}
            >
              <span>Vencidos</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'pago' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pago')}
            >
              <span>Pagos</span>
              <span className="excel-filter-count">{totals.countPagos}</span>
            </button>
          </div>
        </div>

        {/* Tabela Excel Completa */}
        <div className="excel-table-container">
          <table className="excel-table" style={{ minWidth: '950px' }}>
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '220px' }}>NOME DE QUEM DEVEMOS</th>
                <th style={{ minWidth: '220px' }}>DESCRIÇÃO / MOTIVO</th>
                <th style={{ minWidth: '130px', textAlign: 'center' }}>DATA DE VENCIMENTO</th>
                <th style={{ minWidth: '130px', textAlign: 'right' }}>VALOR</th>
                <th style={{ minWidth: '110px', textAlign: 'center' }}>STATUS</th>
                <th style={{ minWidth: '150px', textAlign: 'center' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
                    Carregando registros de quem devemos...
                  </td>
                </tr>
              ) : filteredContas.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '10px', fontSize: '0.95rem' }}>
                      Nenhum débito encontrado para os filtros selecionados.
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        setContaToEdit(null);
                        setIsModalOpen(true);
                      }}
                      style={{
                        fontWeight: 600,
                        marginTop: '0.5rem',
                      }}
                    >
                      <PlusCircle size={14} /> Cadastrar Quem Devemos
                    </button>
                  </td>
                </tr>
              ) : (
                filteredContas.map((c, idx) => {
                  const isVencido =
                    !c.pago &&
                    c.data_vencimento &&
                    c.data_vencimento < new Date().toISOString().split('T')[0];

                  return (
                    <tr
                      key={c.id}
                      className={c.pago ? 'row-pago' : isVencido ? 'row-vencido' : ''}
                      style={{ opacity: c.pago ? 0.7 : 1 }}
                    >
                      <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                        {idx + 1}
                      </td>

                      <td>
                        <strong style={{ color: '#fff', fontSize: '0.92rem' }}>
                          {c.nome_credor}
                        </strong>
                        {c.observacoes && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '3px' }}>
                            Obs: {c.observacoes}
                          </div>
                        )}
                      </td>

                      <td>
                        <span style={{ color: 'var(--text-main)', fontSize: '0.86rem' }}>
                          {c.descricao || '-'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {c.data_vencimento ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.84rem',
                              color: isVencido ? '#f87171' : 'var(--text-main)',
                              fontWeight: isVencido ? 600 : 400,
                            }}
                          >
                            <Calendar size={13} color={isVencido ? '#ef4444' : 'var(--text-dim)'} />
                            {formatDate(c.data_vencimento)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>-</span>
                        )}
                      </td>

                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: c.pago ? '#34d399' : '#f87171',
                          fontSize: '0.96rem',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        R$ {Number(c.valor).toFixed(2).replace('.', ',')}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {c.pago ? (
                          <span className="badge badge-pago" style={{ padding: '4px 10px' }}>
                            <Check size={11} /> Pago
                          </span>
                        ) : isVencido ? (
                          <span className="badge badge-vencido" style={{ padding: '4px 10px' }}>
                            ● Vencido
                          </span>
                        ) : (
                          <span className="badge badge-avisado" style={{ padding: '4px 10px' }}>
                            ● A Pagar
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            className={`btn btn-sm ${c.pago ? 'btn-secondary' : 'btn-primary'}`}
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.76rem',
                              gap: '4px',
                              fontWeight: 600,
                            }}
                            onClick={() => handleTogglePaga(c)}
                            disabled={payingContaId === c.id}
                            title={c.pago ? 'Desmarcar pagamento' : 'Registrar pagamento efetuado'}
                          >
                            <Check size={12} />
                            {c.pago ? 'Desfazer' : 'Pagar'}
                          </button>
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => {
                              setContaToEdit(c);
                              setIsModalOpen(true);
                            }}
                            title="Editar lançamento"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => handleDelete(c)}
                            title="Excluir lançamento"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
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
                  <td colSpan={4} style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    <strong style={{ color: '#fff' }}>TOTAL A PAGAR (PENDENTE)</strong>:
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      color: '#f87171',
                      fontSize: '1rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    R${' '}
                    {filteredContas
                      .filter((c) => !c.pago)
                      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </td>
                  <td colSpan={2} style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                    Calculado em tempo real
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal */}
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
