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
        return <span className="badge badge-pago">Pago</span>;
      case 'avisado_3d':
        return <span className="badge badge-avisado">Avisado (3d)</span>;
      case 'avisado_1d':
        return <span className="badge badge-avisado">Avisado (1d)</span>;
      case 'vencido':
        return <span className="badge badge-vencido">Vencido</span>;
      default:
        return <span className="badge badge-pendente">Pendente</span>;
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Table size={24} color="var(--primary)" />
            <h2 style={{ fontSize: '1.45rem', fontWeight: 700 }}>Planilha de Cobranças & Vendas</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
            Visão consolidada estilo planilha com clientes, valores, parcelas, vencimentos e status.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={onOpenNovoClienteModal}>
            <UserPlus size={15} /> Cadastrar Novo Cliente
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onOpenNovaVendaModal()}>
            <PlusCircle size={15} /> + Nova Venda / Cobrança
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid var(--primary)',
            color: '#34d399',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.875rem',
          }}
        >
          <CheckCircle2 size={18} />
          {feedbackMsg}
        </div>
      )}

      {/* Cards de Métricas da Planilha (KPIs Rápidos) */}
      <div className="grid-cards" style={{ marginBottom: '1.25rem' }}>
        <div className="card stat-card" style={{ padding: '0.9rem 1.15rem' }}>
          <div className="stat-info">
            <span className="stat-label">Total a Receber (Em Aberto)</span>
            <span className="stat-value" style={{ color: '#34d399', fontSize: '1.35rem' }}>
              R$ {totals.valorEmAberto.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <DollarSign size={24} color="var(--primary)" />
        </div>

        <div className="card stat-card" style={{ padding: '0.9rem 1.15rem' }}>
          <div className="stat-info">
            <span className="stat-label">Vencidos (Atenção)</span>
            <span className="stat-value" style={{ color: '#f87171', fontSize: '1.35rem' }}>
              {totals.countVencidos} {totals.countVencidos === 1 ? 'venda' : 'vendas'}
            </span>
          </div>
          <AlertCircle size={24} color="var(--danger)" />
        </div>

        <div className="card stat-card" style={{ padding: '0.9rem 1.15rem' }}>
          <div className="stat-info">
            <span className="stat-label">Recebidos no Ciclo</span>
            <span className="stat-value" style={{ color: '#60a5fa', fontSize: '1.35rem' }}>
              R$ {totals.valorRecebido.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <CheckCircle2 size={24} color="#60a5fa" />
        </div>

        <div className="card stat-card" style={{ padding: '0.9rem 1.15rem' }}>
          <div className="stat-info">
            <span className="stat-label">Clientes / Contratos</span>
            <span className="stat-value" style={{ fontSize: '1.35rem' }}>
              {clientes.length}{' '}
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                ({totals.totalRegistros} vendas)
              </span>
            </span>
          </div>
          <Table size={24} color="var(--text-muted)" />
        </div>
      </div>

      {/* Tabela Principal Estilo Excel */}
      <div className="excel-wrapper">
        {/* Barra de Ferramentas / Filtros Estilo Planilha */}
        <div className="excel-toolbar">
          {/* Campo de Busca Rápida */}
          <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 280px' }}>
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, WhatsApp ou descrição do aparelho/serviço..."
              style={{ paddingLeft: '2.2rem', fontSize: '0.825rem', height: '36px' }}
            />
            <Search
              size={15}
              color="var(--text-dim)"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>

          {/* Abas Rápidas de Filtro de Status */}
          <div className="excel-filters">
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'todos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('todos')}
            >
              Todas ({totals.totalRegistros})
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'pendente' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pendente')}
            >
              Pendentes ({totals.countPendentes})
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'avisado' ? 'active' : ''}`}
              onClick={() => setStatusFilter('avisado')}
            >
              Avisados ({totals.countAvisados})
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'vencido' ? 'active' : ''}`}
              onClick={() => setStatusFilter('vencido')}
            >
              Vencidos ({totals.countVencidos})
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'pago' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pago')}
            >
              Pagos ({totals.countPagos})
            </button>
          </div>

          {/* Ordenação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Ordenar:</span>
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{ fontSize: '0.8rem', padding: '4px 8px', height: '32px' }}
            >
              <option value="vencimento">Vencimento mais próximo</option>
              <option value="nome">Cliente (A-Z)</option>
              <option value="valor">Maior valor</option>
            </select>
          </div>
        </div>

        {/* Tabela Excel */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="excel-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Descrição da Venda / Aparelho</th>
                <th style={{ textAlign: 'center' }}>Parcelas</th>
                <th style={{ textAlign: 'right' }}>Valor Parcela</th>
                <th style={{ textAlign: 'right' }}>Valor Total</th>
                <th style={{ textAlign: 'center' }}>Dia Fixo</th>
                <th>Vencimento Atual</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center', minWidth: '150px' }}>Ações Rápidas</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                    Carregando registros da planilha...
                  </td>
                </tr>
              ) : filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.95rem' }}>
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

                  return (
                    <tr key={v.id} style={{ opacity: v.ativo ? 1 : 0.6 }}>
                      {/* # Linha */}
                      <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {idx + 1}
                      </td>

                      {/* Nome do Cliente */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: '#fff' }}>
                            {v.cliente?.nome || 'Cliente Desconhecido'}
                          </span>
                          {v.cliente && (
                            <button
                              type="button"
                              onClick={() => onEditCliente(v.cliente!)}
                              title="Editar dados cadastrais do cliente"
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* WhatsApp com link direto */}
                      <td>
                        {v.cliente?.whatsapp ? (
                          <a
                            href={`https://wa.me/${v.cliente.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: '#34d399',
                              textDecoration: 'none',
                              fontSize: '0.8rem',
                              fontFamily: 'monospace',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.08)',
                            }}
                            title="Abrir conversa no WhatsApp"
                          >
                            <Phone size={11} />
                            <span>{formatFullWhatsApp(v.cliente.whatsapp)}</span>
                            <ExternalLink size={10} style={{ opacity: 0.7 }} />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>-</span>
                        )}
                      </td>

                      {/* Descrição do Produto / Serviço */}
                      <td>
                        <div style={{ fontWeight: 500, color: '#e2e8f0' }}>{v.descricao}</div>
                        {!v.ativo && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--danger)' }}>
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
                            style={{ fontSize: '0.72rem', padding: '2px 8px', fontWeight: 600 }}
                          >
                            {v.parcela_atual || 1} / {v.total_parcelas}x
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            1x (À vista)
                          </span>
                        )}
                      </td>

                      {/* Valor da Parcela */}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399', fontSize: '0.88rem' }}>
                        R$ {Number(v.valor).toFixed(2).replace('.', ',')}
                      </td>

                      {/* Valor Total */}
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        R$ {Number(valorTotalCalc).toFixed(2).replace('.', ',')}
                      </td>

                      {/* Dia Fixo */}
                      <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                        Dia {v.dia_vencimento}
                      </td>

                      {/* Vencimento Atual */}
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                          <Calendar size={12} color="var(--text-dim)" />
                          {formatDate(v.data_vencimento_atual)}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        {getStatusBadge(v.status_mes_atual)}
                      </td>

                      {/* Ações Rápidas */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {v.ativo && v.status_mes_atual !== 'pago' && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleMarkAsPaid(v)}
                              disabled={payingVendaId === v.id}
                              title="Confirmar recebimento do pagamento"
                            >
                              <Check size={12} />
                              {payingVendaId === v.id ? 'Salvando...' : 'Marcar Pago'}
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 6px' }}
                            onClick={() => onOpenHistoricoModal(v)}
                            title="Ver histórico de mensagens WhatsApp"
                          >
                            <History size={13} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 6px' }}
                            onClick={() => onEditVenda(v)}
                            title="Editar dados da venda"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 6px' }}
                            onClick={() => handleToggleVendaAtivo(v)}
                            title={v.ativo ? 'Pausar cobrança' : 'Reativar cobrança'}
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

            {/* Linha de Totais da Planilha (Estilo Excel Footer) */}
            {filteredVendas.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    TOTALIZADOR ({filteredVendas.length} {filteredVendas.length === 1 ? 'registro' : 'registros'} exibidos):
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--text-dim)' }}>-</td>
                  <td style={{ textAlign: 'right', color: '#34d399', fontSize: '0.95rem' }}>
                    R${' '}
                    {filteredVendas
                      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </td>
                  <td style={{ textAlign: 'right', color: '#fff', fontSize: '0.9rem' }}>
                    R${' '}
                    {filteredVendas
                      .reduce((acc, curr) => acc + (Number(curr.valor_total) || Number(curr.valor) * (curr.total_parcelas || 1)), 0)
                      .toFixed(2)
                      .replace('.', ',')}
                  </td>
                  <td colSpan={4} style={{ textAlign: 'right', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                    Valores calculados automaticamente
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
