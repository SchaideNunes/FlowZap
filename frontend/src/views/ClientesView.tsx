import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  UserPlus,
  PlusCircle,
  CheckCircle2,
  ExternalLink,
  Edit2,
  History,
  ToggleLeft,
  ToggleRight,
  Phone,
  Table,
  DollarSign,
  AlertCircle,
  Calendar,
  Check,
  ArrowUpDown,
  X,
} from 'lucide-react';
import { Cliente, Venda } from '../types/index.js';
import { api } from '../services/api.js';
import { formatFullWhatsApp } from '../utils/phone.js';

interface ClientesViewProps {
  onOpenNovoClienteModal: () => void;
  onEditCliente: (cliente: Cliente) => void;
  onOpenNovaVendaModal: (clienteId?: number) => void;
  onEditVenda: (venda: Venda) => void;
  onOpenHistoricoModal: (venda: Venda) => void;
}

type StatusFilter = 'todos' | 'pendente' | 'avisado' | 'vencido' | 'pago';
type SortOption = 'vencimento' | 'nome' | 'valor';

export const ClientesView: React.FC<ClientesViewProps> = ({
  onOpenNovoClienteModal,
  onEditCliente,
  onOpenNovaVendaModal,
  onEditVenda,
  onOpenHistoricoModal,
}) => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [sortBy, setSortBy] = useState<SortOption>('vencimento');
  const [payingVendaId, setPayingVendaId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vendasRes, clientesRes] = await Promise.all([
        api.get('/vendas'),
        api.get('/clientes'),
      ]);
      setVendas(vendasRes.data);
      setClientes(clientesRes.data);
    } catch {
      // Ignora erro passageiro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMarkAsPaid = async (venda: Venda) => {
    const isParcelado = venda.total_parcelas && venda.total_parcelas > 1;
    const infoParcela = isParcelado
      ? ` (Parcela ${venda.parcela_atual || 1} de ${venda.total_parcelas})`
      : '';

    const confirm = window.confirm(
      `Confirmar recebimento do pagamento de "${venda.descricao}"${infoParcela} no valor de R$ ${Number(venda.valor).toFixed(2).replace('.', ',')}?`
    );
    if (!confirm) return;

    setPayingVendaId(venda.id);
    try {
      await api.patch(`/vendas/${venda.id}/pago`);
      setFeedbackMsg(`Pagamento de "${venda.descricao}" confirmado com sucesso!`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao registrar pagamento.');
    } finally {
      setPayingVendaId(null);
    }
  };

  const handleToggleVendaAtivo = async (venda: Venda) => {
    try {
      await api.patch(`/vendas/${venda.id}/status`, { ativo: !venda.ativo });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar status da cobrança.');
    }
  };

  // Filtragem e ordenação dinâmica em tempo real (como no Excel)
  const filteredVendas = useMemo(() => {
    return vendas
      .filter((v) => {
        // Busca textual por nome do cliente, WhatsApp ou descrição do item
        const term = search.toLowerCase().trim();
        if (term) {
          const matchNome = (v.cliente?.nome || '').toLowerCase().includes(term);
          const matchWhats = (v.cliente?.whatsapp || '').includes(term);
          const matchDesc = (v.descricao || '').toLowerCase().includes(term);
          if (!matchNome && !matchWhats && !matchDesc) return false;
        }

        // Filtro por status
        if (statusFilter === 'pendente') return v.status_mes_atual === 'pendente';
        if (statusFilter === 'avisado') return v.status_mes_atual.startsWith('avisado');
        if (statusFilter === 'vencido') return v.status_mes_atual === 'vencido';
        if (statusFilter === 'pago') return v.status_mes_atual === 'pago';

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'nome') {
          return (a.cliente?.nome || '').localeCompare(b.cliente?.nome || '');
        }
        if (sortBy === 'valor') {
          return Number(b.valor) - Number(a.valor);
        }
        // Padrão: Vencimento mais próximo
        return (a.data_vencimento_atual || '').localeCompare(b.data_vencimento_atual || '');
      });
  }, [vendas, search, statusFilter, sortBy]);

  // Totais da Planilha
  const totals = useMemo(() => {
    let sumParcelas = 0;
    let sumTotalVendas = 0;
    let countPendentes = 0;
    let countAvisados = 0;
    let countVencidos = 0;
    let countPagos = 0;
    let valorRecebido = 0;
    let valorEmAberto = 0;

    vendas.forEach((v) => {
      const vParcela = Number(v.valor) || 0;
      const vTotal = Number(v.valor_total) || vParcela * (v.total_parcelas || 1);
      sumParcelas += vParcela;
      sumTotalVendas += vTotal;

      if (v.status_mes_atual === 'pago') {
        countPagos++;
        valorRecebido += vParcela;
      } else {
        valorEmAberto += vParcela;
        if (v.status_mes_atual === 'vencido') countVencidos++;
        else if (v.status_mes_atual.startsWith('avisado')) countAvisados++;
        else countPendentes++;
      }
    });

    return {
      sumParcelas,
      sumTotalVendas,
      countPendentes,
      countAvisados,
      countVencidos,
      countPagos,
      valorRecebido,
      valorEmAberto,
      totalRegistros: vendas.length,
    };
  }, [vendas]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return (
          <span className="badge badge-pago" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
            <Check size={11} /> Pago
          </span>
        );
      case 'avisado_3d':
        return (
          <span className="badge badge-avisado" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
            ● Avisado (3d)
          </span>
        );
      case 'avisado_1d':
        return (
          <span className="badge badge-avisado" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
            ● Avisado (1d)
          </span>
        );
      case 'vencido':
        return (
          <span className="badge badge-vencido" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
            ● Vencido
          </span>
        );
      default:
        return (
          <span className="badge badge-pendente" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
            ● Pendente
          </span>
        );
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };


  return (
    <div>
      {/* Top Header com Título e Botões de Ação */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Table size={20} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: '1.55rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Planilha de Cobranças & Vendas
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
            Visão centralizada estilo planilha para controle de vendas parceladas, vencimentos e histórico WhatsApp.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={onOpenNovoClienteModal} style={{ padding: '0.5rem 1rem' }}>
            <UserPlus size={16} /> Cadastrar Novo Cliente
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onOpenNovaVendaModal()} style={{ padding: '0.5rem 1.15rem', fontWeight: 600 }}>
            <PlusCircle size={16} /> + Nova Venda / Cobrança
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

      {/* Cards de Métricas da Planilha (KPIs Rápidos) */}
      <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
        <div className="card stat-card" style={{ padding: '1.1rem 1.25rem', borderLeft: '3px solid #10b981' }}>
          <div className="stat-info">
            <span className="stat-label">A RECEBER NO CICLO</span>
            <span className="stat-value" style={{ color: '#34d399', fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums' }}>
              R$ {totals.valorEmAberto.toFixed(2).replace('.', ',')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {totals.countPendentes + totals.countAvisados} parcelas em aberto
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <DollarSign size={22} color="#10b981" />
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '1.1rem 1.25rem', borderLeft: `3px solid ${totals.countVencidos > 0 ? '#ef4444' : 'var(--border-subtle)'}` }}>
          <div className="stat-info">
            <span className="stat-label">VENCIDOS (ATENÇÃO)</span>
            <span className="stat-value" style={{ color: totals.countVencidos > 0 ? '#f87171' : '#fff', fontSize: '1.5rem' }}>
              {totals.countVencidos} {totals.countVencidos === 1 ? 'venda' : 'vendas'}
            </span>
            <span style={{ fontSize: '0.75rem', color: totals.countVencidos > 0 ? '#f87171' : 'var(--text-dim)', marginTop: '4px' }}>
              {totals.countVencidos > 0 ? 'Requer cobrança imediata' : 'Nenhuma parcela atrasada'}
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <AlertCircle size={22} color={totals.countVencidos > 0 ? '#ef4444' : 'var(--text-dim)'} />
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '1.1rem 1.25rem', borderLeft: '3px solid #3b82f6' }}>
          <div className="stat-info">
            <span className="stat-label">RECEBIDOS NO CICLO</span>
            <span className="stat-value" style={{ color: '#60a5fa', fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums' }}>
              R$ {totals.valorRecebido.toFixed(2).replace('.', ',')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {totals.countPagos} parcelas confirmadas
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            <CheckCircle2 size={22} color="#3b82f6" />
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '1.1rem 1.25rem', borderLeft: '3px solid #8b5cf6' }}>
          <div className="stat-info">
            <span className="stat-label">BASE DE CLIENTES</span>
            <span className="stat-value" style={{ fontSize: '1.5rem' }}>
              {clientes.length}{' '}
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                ({totals.totalRegistros} vendas)
              </span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Clientes cadastrados na loja
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
            <Table size={22} color="#a78bfa" />
          </div>
        </div>
      </div>

      {/* Tabela Principal Estilo Excel */}
      <div className="excel-wrapper">
        {/* Barra de Ferramentas / Filtros Estilo Planilha */}
        <div className="excel-toolbar">
          {/* Campo de Busca Rápida */}
          <div className="excel-search-box">
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, WhatsApp ou aparelho..."
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

          {/* Abas Rápidas de Filtro de Status com Contador */}
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
              <span>Pendentes</span>
              <span className="excel-filter-count">{totals.countPendentes}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'avisado' ? 'active' : ''}`}
              onClick={() => setStatusFilter('avisado')}
            >
              <span>Avisados</span>
              <span className="excel-filter-count">{totals.countAvisados}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'vencido' ? 'active' : ''}`}
              onClick={() => setStatusFilter('vencido')}
            >
              <span>Vencidos</span>
              <span
                className="excel-filter-count"
                style={{ color: totals.countVencidos > 0 ? '#f87171' : undefined }}
              >
                {totals.countVencidos}
              </span>
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

          {/* Controles de Ordenação e Contador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowUpDown size={14} color="var(--text-dim)" />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Ordenar:</span>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{ fontSize: '0.8rem', padding: '5px 10px', height: '34px', borderRadius: '6px' }}
              >
                <option value="vencimento">Vencimento mais próximo</option>
                <option value="nome">Cliente (A-Z)</option>
                <option value="valor">Maior valor</option>
              </select>
            </div>

            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                whiteSpace: 'nowrap',
              }}
            >
              Exibindo <strong>{filteredVendas.length}</strong> de {vendas.length}
            </div>
          </div>
        </div>

        {/* Tabela Excel com Scroll Suave e Largura Mínima Garantida */}
        <div className="excel-table-container">
          <table className="excel-table">
            <thead>
              <tr>
                <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '180px' }}>Cliente</th>
                <th style={{ minWidth: '190px' }}>WhatsApp</th>
                <th style={{ minWidth: '220px' }}>Descrição da Venda / Aparelho</th>
                <th style={{ minWidth: '110px', textAlign: 'center' }}>Parcelas</th>
                <th style={{ minWidth: '130px', textAlign: 'right' }}>Valor Parcela</th>
                <th style={{ minWidth: '130px', textAlign: 'right' }}>Valor Total</th>
                <th style={{ minWidth: '95px', textAlign: 'center' }}>Dia Fixo</th>
                <th style={{ minWidth: '135px', textAlign: 'center' }}>Vencimento Atual</th>
                <th style={{ minWidth: '125px', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '210px', textAlign: 'center' }}>Ações Rápidas</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
                    Carregando registros da planilha...
                  </td>
                </tr>
              ) : filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '10px', fontSize: '0.95rem' }}>
                      Nenhuma venda encontrada para os filtros atuais.
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onOpenNovaVendaModal()}
                      style={{ marginTop: '0.5rem' }}
                    >
                      <PlusCircle size={14} /> Cadastrar Nova Venda
                    </button>
                  </td>
                </tr>
              ) : (
                filteredVendas.map((v, idx) => {
                  const isParcelado = v.total_parcelas && v.total_parcelas > 1;
                  const valorTotalCalc = v.valor_total || Number(v.valor) * (v.total_parcelas || 1);
                  const isVencido = v.status_mes_atual === 'vencido';
                  const isPago = v.status_mes_atual === 'pago';

                  return (
                    <tr
                      key={v.id}
                      className={isVencido ? 'row-vencido' : isPago ? 'row-pago' : ''}
                      style={{ opacity: v.ativo ? 1 : 0.6 }}
                    >
                      {/* # Linha */}
                      <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.76rem', fontFamily: 'monospace' }}>
                        {idx + 1}
                      </td>

                      {/* Nome do Cliente */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>
                            {v.cliente?.nome || 'Cliente Desconhecido'}
                          </span>
                          {v.cliente && (
                            <button
                              type="button"
                              onClick={() => onEditCliente(v.cliente!)}
                              title="Editar dados cadastrais do cliente"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-dim)',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: '4px',
                              }}
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* WhatsApp com Pill de 1 clique no wa.me */}
                      <td>
                        {v.cliente?.whatsapp ? (
                          <a
                            href={`https://wa.me/${v.cliente.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="whatsapp-pill-btn"
                            title="Abrir conversa no WhatsApp Web"
                          >
                            <Phone size={11} />
                            <span>{formatFullWhatsApp(v.cliente.whatsapp)}</span>
                            <ExternalLink size={10} style={{ opacity: 0.7 }} />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>-</span>
                        )}
                      </td>

                      {/* Descrição do Produto / Aparelho */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#f3f4f6', fontSize: '0.86rem' }}>
                          {v.descricao}
                        </div>
                        {!v.ativo && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 500 }}>
                            {isParcelado && v.parcela_atual && v.parcela_atual >= v.total_parcelas!
                              ? 'Totalmente Quitado'
                              : 'Cobrança Pausada'}
                          </span>
                        )}
                      </td>

                      {/* Parcelas */}
                      <td style={{ textAlign: 'center' }}>
                        {isParcelado ? (
                          <span
                            className="badge badge-avisado"
                            style={{ fontSize: '0.74rem', padding: '3px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            {v.parcela_atual || 1} / {v.total_parcelas}x
                          </span>
                        ) : (
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.74rem',
                              padding: '3px 8px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-subtle)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            1x (À vista)
                          </span>
                        )}
                      </td>

                      {/* Valor da Parcela */}
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#34d399',
                          fontSize: '0.9rem',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        R$ {Number(v.valor).toFixed(2).replace('.', ',')}
                      </td>

                      {/* Valor Total */}
                      <td
                        style={{
                          textAlign: 'right',
                          color: 'var(--text-main)',
                          fontSize: '0.85rem',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        R$ {Number(valorTotalCalc).toFixed(2).replace('.', ',')}
                      </td>

                      {/* Dia Fixo */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid var(--border-subtle)',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            color: 'var(--text-dim)',
                            fontFamily: 'monospace',
                          }}
                        >
                          Dia {String(v.dia_vencimento).padStart(2, '0')}
                        </span>
                      </td>

                      {/* Vencimento Atual */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.82rem',
                            color: isVencido ? '#f87171' : 'var(--text-main)',
                            fontWeight: isVencido ? 600 : 400,
                          }}
                        >
                          <Calendar size={13} color={isVencido ? '#ef4444' : 'var(--text-dim)'} />
                          {formatDate(v.data_vencimento_atual)}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        {getStatusBadge(v.status_mes_atual)}
                      </td>

                      {/* Ações Rápidas */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {v.ativo && v.status_mes_atual !== 'pago' && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.76rem', gap: '4px', fontWeight: 600 }}
                              onClick={() => handleMarkAsPaid(v)}
                              disabled={payingVendaId === v.id}
                              title="Confirmar recebimento do pagamento"
                            >
                              <Check size={13} />
                              {payingVendaId === v.id ? 'Salvando...' : 'Marcar Pago'}
                            </button>
                          )}

                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => onOpenHistoricoModal(v)}
                            title="Ver histórico de mensagens WhatsApp"
                          >
                            <History size={14} />
                          </button>

                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => onEditVenda(v)}
                            title="Editar dados da venda"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => handleToggleVendaAtivo(v)}
                            title={v.ativo ? 'Pausar cobrança' : 'Reativar cobrança'}
                          >
                            {v.ativo ? (
                              <ToggleRight size={15} color="var(--primary)" />
                            ) : (
                              <ToggleLeft size={15} color="var(--text-dim)" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Linha de Totais da Planilha (Estilo Excel Footer) */}
            {filteredVendas.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    <strong style={{ color: '#fff' }}>TOTAL CONSOLIDADO</strong> ({filteredVendas.length}{' '}
                    {filteredVendas.length === 1 ? 'registro exibido' : 'registros exibidos'}):
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--text-dim)' }}>-</td>
                  <td
                    style={{
                      textAlign: 'right',
                      color: '#34d399',
                      fontSize: '0.96rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    R${' '}
                    {filteredVendas
                      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      color: '#fff',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    R${' '}
                    {filteredVendas
                      .reduce(
                        (acc, curr) =>
                          acc +
                          (Number(curr.valor_total) ||
                            Number(curr.valor) * (curr.total_parcelas || 1)),
                        0
                      )
                      .toFixed(2)
                      .replace('.', ',')}
                  </td>
                  <td colSpan={4} style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                    Valores calculados automaticamente em tempo real
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
