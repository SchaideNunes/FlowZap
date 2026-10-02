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
  Calendar,
  Check,
  X,
  Trash2,
  TrendingUp,
  LayoutGrid,
  CreditCard,
  Building2,
} from 'lucide-react';
import { Cliente, Venda, ContaPagar } from '../types/index.js';
import { api } from '../services/api.js';
import { formatFullWhatsApp } from '../utils/phone.js';
import { ContaPagarModal } from '../components/ContaPagarModal.js';

interface ClientesViewProps {
  onOpenNovoClienteModal: () => void;
  onEditCliente: (cliente: Cliente) => void;
  onOpenNovaVendaModal: (clienteId?: number) => void;
  onEditVenda: (venda: Venda) => void;
  onOpenHistoricoModal: (venda: Venda) => void;
}

type TabViewMode = 'unificada' | 'devedores' | 'credores';
type StatusFilter = 'todos' | 'pendente' | 'vencido' | 'pago';

export const ClientesView: React.FC<ClientesViewProps> = ({
  onOpenNovoClienteModal,
  onEditCliente,
  onOpenNovaVendaModal,
  onEditVenda,
  onOpenHistoricoModal,
}) => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tabMode, setTabMode] = useState<TabViewMode>('unificada');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [payingVendaId, setPayingVendaId] = useState<number | null>(null);
  const [payingContaId, setPayingContaId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Modal de Conta a Pagar (Quem Devemos)
  const [isContaModalOpen, setIsContaModalOpen] = useState(false);
  const [contaToEdit, setContaToEdit] = useState<ContaPagar | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vendasRes, clientesRes, contasRes] = await Promise.all([
        api.get('/vendas'),
        api.get('/clientes'),
        api.get('/contas-pagar'),
      ]);
      setVendas(vendasRes.data || []);
      setClientes(clientesRes.data || []);
      setContasPagar(contasRes.data || []);
    } catch {
      // Ignora erro passageiro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Marcar recebimento de venda de cliente
  const handleMarkAsPaid = async (venda: Venda) => {
    const isParcelado = venda.total_parcelas && venda.total_parcelas > 1;
    const infoParcela = isParcelado
      ? ` (Parcela ${venda.parcela_atual || 1} de ${venda.total_parcelas})`
      : '';

    const confirm = window.confirm(
      `Confirmar recebimento do pagamento de "${venda.descricao}"${infoParcela} no valor de R$ ${Number(
        venda.valor
      )
        .toFixed(2)
        .replace('.', ',')}?`
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

  // Toggle de pagamento de Conta a Pagar (Quem Devemos)
  const handleToggleContaPaga = async (conta: ContaPagar) => {
    const novoStatus = !conta.pago;
    setPayingContaId(conta.id);
    try {
      await api.put(`/contas-pagar/${conta.id}`, {
        pago: novoStatus,
        data_pagamento: novoStatus ? new Date().toISOString().split('T')[0] : null,
      });
      setFeedbackMsg(
        novoStatus
          ? `Dívida de "${conta.nome_credor}" marcada como PAGA!`
          : `Dívida de "${conta.nome_credor}" marcada como PENDENTE.`
      );
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao atualizar conta a pagar.');
    } finally {
      setPayingContaId(null);
    }
  };

  // Excluir Conta a Pagar
  const handleDeleteConta = async (conta: ContaPagar) => {
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
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir conta a pagar.');
    }
  };

  // Filtragem Clientes Devedores
  const filteredVendas = useMemo(() => {
    return vendas
      .filter((v) => {
        const term = search.toLowerCase().trim();
        if (term) {
          const matchNome = (v.cliente?.nome || '').toLowerCase().includes(term);
          const matchWhats = (v.cliente?.whatsapp || '').includes(term);
          const matchDesc = (v.descricao || '').toLowerCase().includes(term);
          if (!matchNome && !matchWhats && !matchDesc) return false;
        }

        if (statusFilter === 'pendente') return v.status_mes_atual === 'pendente' || v.status_mes_atual.startsWith('avisado');
        if (statusFilter === 'vencido') return v.status_mes_atual === 'vencido';
        if (statusFilter === 'pago') return v.status_mes_atual === 'pago';

        return true;
      })
      .sort((a, b) => {
        return (a.data_vencimento_atual || '').localeCompare(b.data_vencimento_atual || '');
      });
  }, [vendas, search, statusFilter]);

  // Filtragem Quem Devemos
  const filteredContasPagar = useMemo(() => {
    return contasPagar.filter((c) => {
      const term = search.toLowerCase().trim();
      if (term) {
        const matchNome = c.nome_credor.toLowerCase().includes(term);
        const matchDesc = (c.descricao || '').toLowerCase().includes(term);
        if (!matchNome && !matchDesc) return false;
      }

      if (statusFilter === 'pendente') return !c.pago;
      if (statusFilter === 'pago') return c.pago;
      // Para 'vencido', checa se data de vencimento passou e não está pago
      if (statusFilter === 'vencido') {
        if (c.pago) return false;
        if (!c.data_vencimento) return false;
        return c.data_vencimento < new Date().toISOString().split('T')[0];
      }

      return true;
    });
  }, [contasPagar, search, statusFilter]);

  // Totais Balanço Geral
  const totals = useMemo(() => {
    // Clientes devedores
    const totalDividasClientes = vendas
      .filter((v) => v.status_mes_atual !== 'pago' && v.ativo)
      .reduce((sum, v) => sum + (Number(v.valor) || 0), 0);

    const totalVencidosClientes = vendas
      .filter((v) => v.status_mes_atual === 'vencido' && v.ativo)
      .reduce((sum, v) => sum + (Number(v.valor) || 0), 0);

    const countVencidosClientes = vendas.filter(
      (v) => v.status_mes_atual === 'vencido' && v.ativo
    ).length;

    // Quem Devemos
    const totalQueDevemos = contasPagar
      .filter((c) => !c.pago)
      .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

    const totalPagoCredores = contasPagar
      .filter((c) => c.pago)
      .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

    // Saldo Líquido
    const saldoLiquido = totalDividasClientes - totalQueDevemos;

    return {
      totalDividasClientes,
      totalVencidosClientes,
      countVencidosClientes,
      totalQueDevemos,
      totalPagoCredores,
      saldoLiquido,
    };
  }, [vendas, contasPagar]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return (
          <span className="badge badge-pago" style={{ whiteSpace: 'nowrap', padding: '3px 8px', fontSize: '0.72rem' }}>
            <Check size={11} /> Pago
          </span>
        );
      case 'avisado_3d':
      case 'avisado_1d':
        return (
          <span className="badge badge-avisado" style={{ whiteSpace: 'nowrap', padding: '3px 8px', fontSize: '0.72rem' }}>
            ● Avisado
          </span>
        );
      case 'vencido':
        return (
          <span className="badge badge-vencido" style={{ whiteSpace: 'nowrap', padding: '3px 8px', fontSize: '0.72rem' }}>
            ● Vencido
          </span>
        );
      default:
        return (
          <span className="badge badge-pendente" style={{ whiteSpace: 'nowrap', padding: '3px 8px', fontSize: '0.72rem' }}>
            ● Em Aberto
          </span>
        );
    }
  };

  return (
    <div>
      {/* Top Header com Título e Botões de Ação */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
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
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Table size={20} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Planilha Financeira & Cobranças
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '4px' }}>
            Controle integrado estilo Excel ({clientes.length} clientes na base): <strong>Clientes Devedores</strong> (A Receber) e <strong>Quem Devemos</strong> (Contas a Pagar).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onOpenNovoClienteModal}
            style={{ padding: '0.5rem 1rem' }}
          >
            <UserPlus size={16} /> Cadastrar Cliente
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              setContaToEdit(null);
              setIsContaModalOpen(true);
            }}
            style={{
              padding: '0.5rem 1.15rem',
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
            }}
          >
            <Building2 size={16} /> + Quem Devemos
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onOpenNovaVendaModal()}
            style={{ padding: '0.5rem 1.15rem', fontWeight: 600 }}
          >
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

      {/* DUAL BALANÇO HEADER (Idêntico ao Excel do Lojista: Verde R$ 97k à esq. e Vermelho R$ 8.5k à dir.) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '1.15rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* CARD VERDE: VALOR TOTAL DAS DÍVIDAS (Clientes Devedores) */}
        <div
          className="card"
          style={{
            padding: '1.25rem',
            border: '1px solid rgba(0, 176, 80, 0.4)',
            background: 'linear-gradient(135deg, rgba(0, 176, 80, 0.08) 0%, rgba(17, 24, 39, 0.95) 100%)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.06em', color: '#6ee7b7' }}>
              VALOR TOTAL DAS DÍVIDAS (A RECEBER)
            </span>
            <DollarSign size={18} color="#00b050" />
          </div>

          <div
            className="excel-box-green"
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '1.65rem',
              letterSpacing: '-0.02em',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            R$ {totals.totalDividasClientes.toFixed(2).replace('.', ',')}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>{vendas.filter((v) => v.status_mes_atual !== 'pago' && v.ativo).length} parcelas em aberto</span>
            {totals.countVencidosClientes > 0 && (
              <span style={{ color: '#f87171', fontWeight: 600 }}>
                {totals.countVencidosClientes} vencidas (R$ {totals.totalVencidosClientes.toFixed(2).replace('.', ',')})
              </span>
            )}
          </div>
        </div>

        {/* CARD BALANÇO LÍQUIDO */}
        <div
          className="card"
          style={{
            padding: '1.25rem',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(17, 24, 39, 0.85)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
              SALDO LÍQUIDO PREVISTO
            </span>
            <TrendingUp size={18} color={totals.saldoLiquido >= 0 ? '#10b981' : '#ef4444'} />
          </div>

          <div
            style={{
              background: totals.saldoLiquido >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${totals.saldoLiquido >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: totals.saldoLiquido >= 0 ? '#34d399' : '#f87171',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '1.65rem',
              fontWeight: 800,
              textAlign: 'center',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {totals.saldoLiquido >= 0 ? '+' : ''} R${' '}
            {totals.saldoLiquido.toFixed(2).replace('.', ',')}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '10px' }}>
            (Total a Receber) menos (Total que Devemos)
          </div>
        </div>

        {/* CARD VERMELHO: VALOR TOTAL QUE DEVEMOS (Quem Devemos) */}
        <div
          className="card"
          style={{
            padding: '1.25rem',
            border: '1px solid rgba(192, 0, 0, 0.4)',
            background: 'linear-gradient(135deg, rgba(192, 0, 0, 0.08) 0%, rgba(17, 24, 39, 0.95) 100%)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.06em', color: '#fca5a5' }}>
              VALOR TOTAL QUE DEVEMOS (A PAGAR)
            </span>
            <Building2 size={18} color="#c00000" />
          </div>

          <div
            className="excel-box-red"
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '1.65rem',
              letterSpacing: '-0.02em',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            R$ {totals.totalQueDevemos.toFixed(2).replace('.', ',')}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>{contasPagar.filter((c) => !c.pago).length} credores / contas pendentes</span>
            <span style={{ color: '#34d399' }}>
              Quitados: R$ {totals.totalPagoCredores.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS: BUSCA, ABAS DE VISUALIZAÇÃO E FILTRO DE STATUS */}
      <div className="excel-wrapper" style={{ marginBottom: '1.5rem' }}>
        <div className="excel-toolbar">
          {/* Campo de Busca Unificada */}
          <div className="excel-search-box">
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar devedor, credor, aparelho ou WhatsApp..."
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

          {/* Abas de Modo de Visualização */}
          <div style={{ display: 'flex', gap: '6px', background: '#090e17', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              className={`excel-filter-btn ${tabMode === 'unificada' ? 'active' : ''}`}
              onClick={() => setTabMode('unificada')}
              title="Exibir ambas as tabelas lado a lado conforme a planilha real"
            >
              <LayoutGrid size={14} />
              <span>Planilha Integrada</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${tabMode === 'devedores' ? 'active' : ''}`}
              onClick={() => setTabMode('devedores')}
            >
              <CreditCard size={14} />
              <span>Clientes Devedores ({filteredVendas.length})</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${tabMode === 'credores' ? 'active' : ''}`}
              onClick={() => setTabMode('credores')}
            >
              <Building2 size={14} />
              <span>Quem Devemos ({filteredContasPagar.length})</span>
            </button>
          </div>

          {/* Filtros Rápidos de Status */}
          <div className="excel-filters">
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'todos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('todos')}
            >
              <span>Todos</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'pendente' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pendente')}
            >
              <span>Em Aberto</span>
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
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CORPO DA PLANILHA: LADO A LADO OU TELA CHEIA                   */}
        {/* ============================================================== */}
        <div style={{ padding: '1rem' }}>
          <div className={tabMode === 'unificada' ? 'dual-excel-container' : ''}>
            {/* ------------------------------------------------------------ */}
            {/* SEÇÃO 1: CLIENTES DEVEDORES                                  */}
            {/* ------------------------------------------------------------ */}
            {(tabMode === 'unificada' || tabMode === 'devedores') && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(0, 176, 80, 0.3)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                {/* Header de Seção Clientes Devedores */}
                <div
                  style={{
                    padding: '0.85rem 1.15rem',
                    background: 'linear-gradient(90deg, rgba(0, 176, 80, 0.22) 0%, rgba(15, 23, 42, 0.9) 100%)',
                    borderBottom: '1px solid rgba(0, 176, 80, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#00b050',
                        boxShadow: '0 0 6px #00b050',
                      }}
                    />
                    <strong style={{ color: '#fff', fontSize: '0.9rem', letterSpacing: '0.02em' }}>
                      CLIENTES DEVEDORES
                    </strong>
                    <span style={{ fontSize: '0.76rem', color: '#6ee7b7', background: 'rgba(0,176,80,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                      {filteredVendas.length} registros
                    </span>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onOpenNovaVendaModal()}
                    style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                  >
                    <PlusCircle size={13} /> Nova Cobrança
                  </button>
                </div>

                {/* Tabela de Devedores */}
                <div className="excel-table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="excel-table" style={{ minWidth: tabMode === 'unificada' ? '700px' : '1100px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ minWidth: '190px' }}>NOME CLIENTE DEVEDOR</th>
                        <th style={{ minWidth: '110px', textAlign: 'center' }}>DATA DE PAGAMENTO</th>
                        <th style={{ minWidth: '115px', textAlign: 'right' }}>VALOR DA DÍVIDA</th>
                        <th style={{ minWidth: '90px', textAlign: 'center' }}>STATUS</th>
                        <th style={{ minWidth: '135px', textAlign: 'center' }}>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-dim)' }}>
                            Carregando clientes devedores...
                          </td>
                        </tr>
                      ) : filteredVendas.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                            Nenhum cliente devedor encontrado para o filtro.
                          </td>
                        </tr>
                      ) : (
                        filteredVendas.map((v, idx) => {
                          const isVencido = v.status_mes_atual === 'vencido';
                          const isPago = v.status_mes_atual === 'pago';

                          return (
                            <tr
                              key={v.id}
                              className={isVencido ? 'row-vencido' : isPago ? 'row-pago' : ''}
                              style={{ opacity: v.ativo ? 1 : 0.6 }}
                            >
                              <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                {idx + 1}
                              </td>

                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.86rem' }}>
                                    {v.cliente?.nome || 'Cliente Desconhecido'}
                                  </span>
                                  {v.cliente && (
                                    <button
                                      type="button"
                                      onClick={() => onEditCliente(v.cliente!)}
                                      title="Editar cadastro do cliente"
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-dim)',
                                        cursor: 'pointer',
                                        padding: '1px 3px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <Edit2 size={11} />
                                    </button>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                  {v.cliente?.whatsapp && (
                                    <a
                                      href={`https://wa.me/${v.cliente.whatsapp}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="whatsapp-pill-btn"
                                      title="Abrir WhatsApp"
                                      style={{ padding: '2px 7px', fontSize: '0.73rem' }}
                                    >
                                      <Phone size={10} />
                                      {formatFullWhatsApp(v.cliente.whatsapp)}
                                      <ExternalLink size={9} style={{ opacity: 0.7 }} />
                                    </a>
                                  )}
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                    {v.descricao}
                                  </span>
                                </div>
                              </td>

                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.8rem',
                                    color: isVencido ? '#f87171' : 'var(--text-main)',
                                    fontWeight: isVencido ? 600 : 400,
                                  }}
                                >
                                  <Calendar size={12} color={isVencido ? '#ef4444' : 'var(--text-dim)'} />
                                  {formatDate(v.data_vencimento_atual)}
                                </span>
                              </td>

                              <td
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: '#34d399',
                                  fontSize: '0.92rem',
                                  whiteSpace: 'nowrap',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                R$ {Number(v.valor).toFixed(2).replace('.', ',')}
                              </td>

                              <td style={{ textAlign: 'center' }}>
                                {getStatusBadge(v.status_mes_atual)}
                              </td>

                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  {v.ativo && v.status_mes_atual !== 'pago' && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px', fontWeight: 600 }}
                                      onClick={() => handleMarkAsPaid(v)}
                                      disabled={payingVendaId === v.id}
                                      title="Marcar recebimento desta dívida"
                                    >
                                      <Check size={12} />
                                      {payingVendaId === v.id ? '...' : 'Receber'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="table-action-btn"
                                    onClick={() => onOpenHistoricoModal(v)}
                                    title="Histórico WhatsApp"
                                    style={{ padding: '3px 6px' }}
                                  >
                                    <History size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="table-action-btn"
                                    onClick={() => onEditVenda(v)}
                                    title="Editar venda"
                                    style={{ padding: '3px 6px' }}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="table-action-btn"
                                    onClick={() => handleToggleVendaAtivo(v)}
                                    title={v.ativo ? 'Pausar' : 'Reativar'}
                                    style={{ padding: '3px 6px' }}
                                  >
                                    {v.ativo ? (
                                      <ToggleRight size={14} color="var(--primary)" />
                                    ) : (
                                      <ToggleLeft size={14} color="var(--text-dim)" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {filteredVendas.length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                            TOTAL DEVEDORES:
                          </td>
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
                          <td colSpan={2} style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '0.74rem' }}>
                            Calculado em tempo real
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* SEÇÃO 2: QUEM DEVEMOS (CONTAS A PAGAR / FORNECEDORES)         */}
            {/* ------------------------------------------------------------ */}
            {(tabMode === 'unificada' || tabMode === 'credores') && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(192, 0, 0, 0.3)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                {/* Header de Seção Quem Devemos */}
                <div
                  style={{
                    padding: '0.85rem 1.15rem',
                    background: 'linear-gradient(90deg, rgba(192, 0, 0, 0.22) 0%, rgba(15, 23, 42, 0.9) 100%)',
                    borderBottom: '1px solid rgba(192, 0, 0, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#c00000',
                        boxShadow: '0 0 6px #c00000',
                      }}
                    />
                    <strong style={{ color: '#fff', fontSize: '0.9rem', letterSpacing: '0.02em' }}>
                      NOME DE QUEM DEVEMOS
                    </strong>
                    <span style={{ fontSize: '0.76rem', color: '#fca5a5', background: 'rgba(192,0,0,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                      {filteredContasPagar.length} registros
                    </span>
                  </div>

                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setContaToEdit(null);
                      setIsContaModalOpen(true);
                    }}
                    style={{
                      fontSize: '0.76rem',
                      padding: '4px 10px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                    }}
                  >
                    <PlusCircle size={13} /> + Quem Devemos
                  </button>
                </div>

                {/* Tabela de Quem Devemos */}
                <div className="excel-table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="excel-table" style={{ minWidth: tabMode === 'unificada' ? '540px' : '900px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ minWidth: '180px' }}>NOME DE QUEM DEVEMOS</th>
                        <th style={{ minWidth: '110px', textAlign: 'center' }}>VENCIMENTO</th>
                        <th style={{ minWidth: '110px', textAlign: 'right' }}>VALOR</th>
                        <th style={{ minWidth: '85px', textAlign: 'center' }}>STATUS</th>
                        <th style={{ minWidth: '110px', textAlign: 'center' }}>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-dim)' }}>
                            Carregando registros de quem devemos...
                          </td>
                        </tr>
                      ) : filteredContasPagar.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                            Nenhum débito pendente registrado.
                          </td>
                        </tr>
                      ) : (
                        filteredContasPagar.map((c, idx) => (
                          <tr
                            key={c.id}
                            className={c.pago ? 'row-pago' : ''}
                            style={{ opacity: c.pago ? 0.65 : 1 }}
                          >
                            <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                              {idx + 1}
                            </td>

                            <td>
                              <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.86rem' }}>
                                {c.nome_credor}
                              </div>
                              {c.descricao && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                                  {c.descricao}
                                </div>
                              )}
                            </td>

                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {formatDate(c.data_vencimento)}
                              </span>
                            </td>

                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                color: c.pago ? '#94a3b8' : '#f87171',
                                fontSize: '0.92rem',
                                whiteSpace: 'nowrap',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              R$ {Number(c.valor).toFixed(2).replace('.', ',')}
                            </td>

                            <td style={{ textAlign: 'center' }}>
                              {c.pago ? (
                                <span className="badge badge-pago" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>
                                  <Check size={11} /> Pago
                                </span>
                              ) : (
                                <span className="badge badge-vencido" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>
                                  ● A Pagar
                                </span>
                              )}
                            </td>

                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  className={`btn btn-sm ${c.pago ? 'btn-secondary' : 'btn-primary'}`}
                                  style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '3px', fontWeight: 600 }}
                                  onClick={() => handleToggleContaPaga(c)}
                                  disabled={payingContaId === c.id}
                                  title={c.pago ? 'Desmarcar como pago' : 'Marcar débito como liquidado'}
                                >
                                  <Check size={12} />
                                  {c.pago ? 'Desfazer' : 'Pagar'}
                                </button>
                                <button
                                  type="button"
                                  className="table-action-btn"
                                  onClick={() => {
                                    setContaToEdit(c);
                                    setIsContaModalOpen(true);
                                  }}
                                  title="Editar"
                                  style={{ padding: '3px 6px' }}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="table-action-btn"
                                  onClick={() => handleDeleteConta(c)}
                                  title="Excluir"
                                  style={{ padding: '3px 6px', color: 'var(--danger)' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredContasPagar.length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                            TOTAL QUE DEVEMOS:
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              color: '#f87171',
                              fontSize: '0.96rem',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            R${' '}
                            {filteredContasPagar
                              .filter((c) => !c.pago)
                              .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
                              .toFixed(2)
                              .replace('.', ',')}
                          </td>
                          <td colSpan={2} style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '0.74rem' }}>
                            Pendente a quitar
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para Adicionar / Editar Conta a Pagar (Quem Devemos) */}
      <ContaPagarModal
        isOpen={isContaModalOpen}
        onClose={() => {
          setIsContaModalOpen(false);
          setContaToEdit(null);
        }}
        contaToEdit={contaToEdit}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
};
