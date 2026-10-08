import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Plus,
  CheckCircle2,
  ExternalLink,
  Edit2,
  History,
  Phone,
  Calendar,
  Check,
  ArrowUpDown,
  X,
  RefreshCw,
  Pause,
  Play,
} from 'lucide-react';
import { Cliente, Venda } from '../types/index.js';
import { api } from '../services/api.js';
import { formatFullWhatsApp } from '../utils/phone.js';
import { extractErrorMessage } from '../utils/error.js';
import { formatBRL, formatDateBR } from '../utils/format.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatTile } from '../components/ui/StatTile.js';
import { EmptyState } from '../components/ui/EmptyState.js';

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
      setVendas(vendasRes.data || []);
      setClientes(clientesRes.data || []);
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
      `Confirmar recebimento do pagamento de "${venda.descricao}"${infoParcela} no valor de ${formatBRL(venda.valor)}?`
    );
    if (!confirm) return;

    setPayingVendaId(venda.id);
    try {
      await api.patch(`/vendas/${venda.id}/pago`);
      setFeedbackMsg(`Pagamento de "${venda.descricao}" confirmado com sucesso!`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchData();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Erro ao registrar pagamento.'));
    } finally {
      setPayingVendaId(null);
    }
  };

  const handleToggleVendaAtivo = async (venda: Venda) => {
    try {
      await api.patch(`/vendas/${venda.id}/status`, { ativo: !venda.ativo });
      fetchData();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Erro ao alterar status da cobrança.'));
    }
  };

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
        return (a.data_vencimento_atual || '').localeCompare(b.data_vencimento_atual || '');
      });
  }, [vendas, search, statusFilter, sortBy]);

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

  // Estado da cobrança: ponto colorido + rótulo (a cor nunca vai sozinha)
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return (
          <span className="badge badge-pago">
            <span className="status-dot dot-success" aria-hidden="true" />
            Pago
          </span>
        );
      case 'avisado_3d':
        return (
          <span className="badge badge-avisado" title="Já recebeu lembrete neste ciclo">
            <span className="status-dot dot-warning" aria-hidden="true" />
            Avisado
          </span>
        );
      case 'avisado_1d':
        return (
          <span className="badge badge-avisado" title="Recebeu o lembrete da véspera do vencimento">
            <span className="status-dot dot-warning" aria-hidden="true" />
            Avisado · véspera
          </span>
        );
      case 'vencido':
        return (
          <span className="badge badge-vencido">
            <span className="status-dot dot-danger" aria-hidden="true" />
            Vencido
          </span>
        );
      default:
        return (
          <span className="badge badge-pendente">
            <span className="status-dot dot-neutral" aria-hidden="true" />
            Pendente
          </span>
        );
    }
  };


  const parcelasEmAberto = totals.countPendentes + totals.countAvisados + totals.countVencidos;
  const somaValorFiltrado = filteredVendas.reduce((acc, v) => acc + (Number(v.valor) || 0), 0);
  const somaTotalFiltrado = filteredVendas.reduce(
    (acc, v) => acc + (Number(v.valor_total) || Number(v.valor) * (v.total_parcelas || 1)),
    0
  );

  return (
    <div>
      <PageHeader
        title="Clientes e vendas"
        subtitle={`${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'} · ${totals.totalRegistros} ${
          totals.totalRegistros === 1 ? 'venda' : 'vendas'
        }`}
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onOpenNovoClienteModal}>
              <UserPlus size={14} />
              Novo cliente
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => onOpenNovaVendaModal()}>
              <Plus size={15} />
              Nova venda
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

      {/* Indicadores (os clicáveis filtram a lista) */}
      <div className="grid-cards">
        <StatTile
          label="Em aberto"
          value={formatBRL(totals.valorEmAberto)}
          hint={`${parcelasEmAberto} ${parcelasEmAberto === 1 ? 'parcela a receber' : 'parcelas a receber'}`}
        />
        <StatTile
          label="Vencidas"
          value={totals.countVencidos}
          hint={totals.countVencidos > 0 ? 'Ver quem cobrar' : 'Nenhuma parcela atrasada'}
          tone={totals.countVencidos > 0 ? 'danger' : 'neutral'}
          onClick={() => setStatusFilter('vencido')}
        />
        <StatTile
          label="Recebido no ciclo"
          value={formatBRL(totals.valorRecebido)}
          hint={`${totals.countPagos} ${totals.countPagos === 1 ? 'parcela confirmada' : 'parcelas confirmadas'}`}
          tone={totals.countPagos > 0 ? 'success' : 'neutral'}
          onClick={() => setStatusFilter('pago')}
        />
        <StatTile
          label="Clientes"
          value={clientes.length}
          hint={`${totals.totalRegistros} ${totals.totalRegistros === 1 ? 'venda registrada' : 'vendas registradas'}`}
        />
      </div>

      {/* Tabela Principal Estilo Excel */}
      <div className="excel-wrapper">
        <div className="excel-toolbar">
          <div className="excel-search-box">
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, WhatsApp ou produto"
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
                style={{ color: totals.countVencidos > 0 ? 'var(--danger)' : undefined }}
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

        {/* Planilha (computador e tablet) */}
        <div className="excel-table-container desktop-table-view">
          <table className="excel-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Venda</th>
                <th style={{ textAlign: 'center' }}>Parcela</th>
                <th className="num">Valor</th>
                <th className="num col-optional">Total da venda</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="Carregando vendas..." />
                  </td>
                </tr>
              ) : filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="Nenhuma venda encontrada"
                      text="Ajuste a busca ou os filtros, ou cadastre uma nova venda."
                      action={
                        <button className="btn btn-primary btn-sm" onClick={() => onOpenNovaVendaModal()}>
                          <Plus size={14} /> Nova venda
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredVendas.map((v) => {
                  const isParcelado = Boolean(v.total_parcelas && v.total_parcelas > 1);
                  const valorTotalCalc = v.valor_total || Number(v.valor) * (v.total_parcelas || 1);
                  const isVencido = v.status_mes_atual === 'vencido';
                  const isQuitada = isParcelado && Boolean(v.parcela_atual && v.parcela_atual >= v.total_parcelas!);

                  return (
                    <tr
                      key={v.id}
                      className={isVencido ? 'row-vencido' : ''}
                      style={{ opacity: v.ativo ? 1 : 0.55 }}
                    >
                      <td>
                        <div className="cell-inline">
                          <span className="cell-title">{v.cliente?.nome || 'Cliente desconhecido'}</span>
                          {v.cliente && (
                            <button
                              type="button"
                              className="icon-btn-inline"
                              onClick={() => onEditCliente(v.cliente!)}
                              title="Editar dados do cliente"
                              aria-label="Editar dados do cliente"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                        </div>
                        {v.cliente?.whatsapp && (
                          <a
                            href={`https://wa.me/${v.cliente.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cell-link"
                            title="Abrir conversa no WhatsApp"
                          >
                            <Phone size={11} />
                            {formatFullWhatsApp(v.cliente.whatsapp)}
                          </a>
                        )}
                      </td>

                      <td>
                        {v.descricao}
                        {!v.ativo && (
                          <span className="cell-sub">{isQuitada ? 'Totalmente quitada' : 'Cobrança pausada'}</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {isParcelado ? (
                          <span className="badge" title={`Parcela ${v.parcela_atual || 1} de ${v.total_parcelas}`}>
                            {v.parcela_atual || 1}/{v.total_parcelas}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>À vista</span>
                        )}
                      </td>

                      <td className="num cell-title">{formatBRL(v.valor)}</td>

                      <td className="num col-optional" style={{ color: 'var(--text-muted)' }}>
                        {formatBRL(valorTotalCalc)}
                      </td>

                      <td>
                        <span className={`date-cell ${isVencido ? 'is-overdue' : ''}`}>
                          <Calendar size={13} />
                          {formatDateBR(v.data_vencimento_atual)}
                        </span>
                      </td>

                      <td>{getStatusBadge(v.status_mes_atual)}</td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="cell-actions">
                          {v.ativo && v.status_mes_atual !== 'pago' && (
                            <button
                              className="btn btn-pay btn-sm"
                              onClick={() => handleMarkAsPaid(v)}
                              disabled={payingVendaId === v.id}
                              title="Confirmar que o cliente pagou"
                            >
                              <Check size={14} />
                              {payingVendaId === v.id ? 'Salvando...' : 'Marcar pago'}
                            </button>
                          )}

                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => onOpenHistoricoModal(v)}
                            title="Histórico de mensagens"
                            aria-label="Histórico de mensagens"
                          >
                            <History size={15} />
                          </button>

                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => onEditVenda(v)}
                            title="Editar venda"
                            aria-label="Editar venda"
                          >
                            <Edit2 size={15} />
                          </button>

                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => handleToggleVendaAtivo(v)}
                            title={v.ativo ? 'Pausar cobrança' : 'Reativar cobrança'}
                            aria-label={v.ativo ? 'Pausar cobrança' : 'Reativar cobrança'}
                          >
                            {v.ativo ? <Pause size={15} /> : <Play size={15} />}
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
                  <td colSpan={3} style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                    Total de {filteredVendas.length} {filteredVendas.length === 1 ? 'venda' : 'vendas'}
                  </td>
                  <td className="num">{formatBRL(somaValorFiltrado)}</td>
                  <td className="num col-optional" style={{ color: 'var(--text-muted)' }}>
                    {formatBRL(somaTotalFiltrado)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Cartões (celular) */}
        <div className="mobile-cards-view">
          {loading ? (
            <EmptyState title="Carregando vendas..." />
          ) : filteredVendas.length === 0 ? (
            <EmptyState
              title="Nenhuma venda encontrada"
              text="Ajuste a busca ou os filtros, ou cadastre uma nova venda."
              action={
                <button className="btn btn-primary" onClick={() => onOpenNovaVendaModal()}>
                  <Plus size={16} /> Nova venda
                </button>
              }
            />
          ) : (
            <>
              {filteredVendas.map((v, idx) => {
                const isParcelado = Boolean(v.total_parcelas && v.total_parcelas > 1);
                const valorTotalCalc = v.valor_total || Number(v.valor) * (v.total_parcelas || 1);
                const isVencido = v.status_mes_atual === 'vencido';
                const isPago = v.status_mes_atual === 'pago';
                const isAvisado = v.status_mes_atual.startsWith('avisado');

                return (
                  <div
                    key={v.id}
                    className={`mobile-record-card ${
                      isVencido ? 'card-vencido' : isPago ? 'card-pago' : isAvisado ? 'card-avisado' : ''
                    }`}
                    style={{ opacity: v.ativo ? 1 : 0.6 }}
                  >
                    {/* Quem e o quê */}
                    <div className="mobile-card-header">
                      <div className="mobile-card-title-group">
                        <div className="client-avatar-badge" aria-hidden="true">
                          {v.cliente?.nome ? v.cliente.nome.slice(0, 2).toUpperCase() : `#${idx + 1}`}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-inline">
                            <span className="mobile-card-name">{v.cliente?.nome || 'Cliente desconhecido'}</span>
                            {v.cliente && (
                              <button
                                type="button"
                                onClick={() => onEditCliente(v.cliente!)}
                                className="mobile-icon-btn"
                                title="Editar dados do cliente"
                                aria-label="Editar dados do cliente"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="list-row-sub">{v.descricao}</div>
                        </div>
                      </div>

                      {getStatusBadge(v.status_mes_atual)}
                    </div>

                    {/* Quanto e quando */}
                    <div className="mobile-card-body">
                      <div className="mobile-card-finance-row">
                        <div>
                          <div className="mobile-card-val-label">
                            {isParcelado ? `Parcela ${v.parcela_atual || 1} de ${v.total_parcelas}` : 'Valor'}
                          </div>
                          <div className="mobile-card-val-main">{formatBRL(v.valor)}</div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div className="mobile-card-val-label">Vencimento</div>
                          <span className={`date-cell ${isVencido ? 'is-overdue' : ''}`}>
                            <Calendar size={13} />
                            {formatDateBR(v.data_vencimento_atual)}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-card-meta-grid">
                        {v.cliente?.whatsapp ? (
                          <a
                            href={`https://wa.me/${v.cliente.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cell-link"
                          >
                            <Phone size={12} />
                            {formatFullWhatsApp(v.cliente.whatsapp)}
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span>Sem WhatsApp</span>
                        )}

                        <span>
                          {!v.ativo ? 'Cobrança pausada' : isParcelado ? `Total ${formatBRL(valorTotalCalc)}` : 'À vista'}
                        </span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="mobile-card-actions">
                      {v.ativo && !isPago ? (
                        <button
                          className="btn btn-pay"
                          style={{ flex: 1 }}
                          onClick={() => handleMarkAsPaid(v)}
                          disabled={payingVendaId === v.id}
                        >
                          <Check size={16} />
                          {payingVendaId === v.id ? 'Salvando...' : 'Marcar pago'}
                        </button>
                      ) : (
                        <span className="figure-label" style={{ flex: 1 }}>
                          {isPago ? (
                            <>
                              <CheckCircle2 size={16} color="var(--success)" /> Pagamento confirmado
                            </>
                          ) : (
                            'Cobrança pausada'
                          )}
                        </span>
                      )}

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => onOpenHistoricoModal(v)}
                          title="Histórico de mensagens"
                          aria-label="Histórico de mensagens"
                        >
                          <History size={16} />
                        </button>

                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => onEditVenda(v)}
                          title="Editar venda"
                          aria-label="Editar venda"
                        >
                          <Edit2 size={16} />
                        </button>

                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => handleToggleVendaAtivo(v)}
                          title={v.ativo ? 'Pausar cobrança' : 'Reativar cobrança'}
                          aria-label={v.ativo ? 'Pausar cobrança' : 'Reativar cobrança'}
                        >
                          {v.ativo ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Resumo */}
              <div className="mobile-summary-footer">
                <div>
                  <div className="mobile-card-val-label">
                    Total de {filteredVendas.length} {filteredVendas.length === 1 ? 'venda' : 'vendas'}
                  </div>
                  <div className="figure-value">{formatBRL(somaValorFiltrado)}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="mobile-card-val-label">Total das vendas</div>
                  <div style={{ fontWeight: 600 }}>{formatBRL(somaTotalFiltrado)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
