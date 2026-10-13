import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  UserPlus,
  Plus,
  ExternalLink,
  Edit2,
  History,
  Phone,
  Calendar,
  Check,
  X,
  RefreshCw,
  Undo2,
  AlertTriangle,
} from 'lucide-react';
import { Cliente, PagamentoRecebido, Venda } from '../types/index.js';
import { api } from '../services/api.js';
import { formatFullWhatsApp } from '../utils/phone.js';
import { extractErrorMessage } from '../utils/error.js';
import { formatBRL, formatDateBR, normalizeSearch, todayISO } from '../utils/format.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatTile } from '../components/ui/StatTile.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { Toast, ToastData } from '../components/ui/Toast.js';

interface ClientesViewProps {
  onOpenNovoClienteModal: () => void;
  onEditCliente: (cliente: Cliente) => void;
  onCadastrarClienteDaVenda: (venda: Venda) => void;
  onOpenNovaVendaModal: (clienteId?: number) => void;
  onEditVenda: (venda: Venda) => void;
  onOpenHistoricoModal: (venda: Venda) => void;
}

// Nome de quem comprou: o do cadastro ou, na venda sem cadastro, o que foi digitado
const nomeDoCliente = (v: Venda) => v.cliente?.nome || v.cliente_avulso || '';

type StatusFilter = 'todos' | 'pendente' | 'avisado' | 'vencido' | 'pago';
type SortOption = 'vencimento' | 'nome' | 'valor';

export const ClientesView: React.FC<ClientesViewProps> = ({
  onOpenNovoClienteModal,
  onEditCliente,
  onCadastrarClienteDaVenda,
  onOpenNovaVendaModal,
  onEditVenda,
  onOpenHistoricoModal,
}) => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoRecebido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [sortBy, setSortBy] = useState<SortOption>('vencimento');
  const [payingVendaId, setPayingVendaId] = useState<number | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);
  // Falha ao carregar não pode parecer "nenhuma venda": tem estado e mensagem próprios
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [payTarget, setPayTarget] = useState<Venda | null>(null);
  const [undoTarget, setUndoTarget] = useState<PagamentoRecebido | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastSeq = useRef(0);

  const showToast = (data: Omit<ToastData, 'id'>) => setToast({ id: ++toastSeq.current, ...data });

  // Devolve os pagamentos carregados (ou null em caso de falha) para quem acabou de registrar um
  const fetchData = async (): Promise<PagamentoRecebido[] | null> => {
    setLoading(true);
    try {
      const [vendasRes, clientesRes, pagamentosRes] = await Promise.all([
        api.get('/vendas'),
        api.get('/clientes'),
        // A lista de recebidos não pode impedir a planilha de abrir
        api.get('/vendas/pagamentos').catch(() => ({ data: [] })),
      ]);
      const recebidos: PagamentoRecebido[] = Array.isArray(pagamentosRes.data) ? pagamentosRes.data : [];
      setVendas(vendasRes.data || []);
      setClientes(clientesRes.data || []);
      setPagamentos(recebidos);
      setLoadError(null);
      setHasLoaded(true);
      return recebidos;
    } catch {
      // O detalhe técnico da falha não ajuda quem está na loja; a orientação sim
      setLoadError('Verifique a internet e tente de novo.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const parcelaDe = (venda: Venda) =>
    venda.total_parcelas && venda.total_parcelas > 1
      ? `Parcela ${venda.parcela_atual || 1} de ${venda.total_parcelas}`
      : null;

  const undoPayment = async (pagamentoId: number, nome: string) => {
    setUndoingId(pagamentoId);
    try {
      await api.post(`/vendas/pagamentos/${pagamentoId}/desfazer`);
      setUndoTarget(null);
      showToast({ tone: 'success', message: `Pagamento de ${nome} desfeito. A parcela voltou a ficar em aberto.` });
      await fetchData();
    } catch (err: unknown) {
      setUndoTarget(null);
      showToast({ tone: 'danger', message: extractErrorMessage(err, 'Não foi possível desfazer o pagamento.') });
    } finally {
      setUndoingId(null);
    }
  };

  const confirmPayment = async () => {
    const venda = payTarget;
    if (!venda) return;
    const nome = nomeDoCliente(venda) || 'cliente';

    setPayingVendaId(venda.id);
    try {
      const res = await api.patch(`/vendas/${venda.id}/pago`);
      const atualizada: Venda | undefined = res.data?.venda;
      setPayTarget(null);

      // A venda continua na lista, já no ciclo seguinte: dizer para onde o pagamento foi
      const destino =
        atualizada && !atualizada.ativo
          ? 'Venda quitada.'
          : atualizada?.data_vencimento_atual
            ? `Próxima parcela em ${formatDateBR(atualizada.data_vencimento_atual)}.`
            : '';

      const recebidos = await fetchData();
      const registro = recebidos?.find((p) => p.venda_id === venda.id && p.pode_desfazer);
      showToast({
        tone: 'success',
        message: `Pagamento de ${nome} registrado (${formatBRL(venda.valor)}). ${destino}`.trim(),
        actionLabel: registro ? 'Desfazer' : undefined,
        onAction: registro
          ? () => {
              setToast(null);
              undoPayment(registro.id, nome);
            }
          : undefined,
      });
    } catch (err: unknown) {
      setPayTarget(null);
      showToast({ tone: 'danger', message: extractErrorMessage(err, 'Não foi possível registrar o pagamento.') });
    } finally {
      setPayingVendaId(null);
    }
  };

  const filteredVendas = useMemo(() => {
    return vendas
      .filter((v) => {
        // Sem acento e sem a máscara do telefone: "joao" acha "João", "(75) 99150" acha o número
        const term = normalizeSearch(search);
        if (term) {
          const digits = term.replace(/\D/g, '');
          const matchNome = normalizeSearch(nomeDoCliente(v)).includes(term);
          const matchWhats = digits.length >= 3 && (v.cliente?.whatsapp || '').includes(digits);
          const matchDesc = normalizeSearch(v.descricao).includes(term);
          if (!matchNome && !matchWhats && !matchDesc) return false;
        }

        if (statusFilter === 'pendente') return v.status_mes_atual === 'pendente';
        if (statusFilter === 'avisado') return v.status_mes_atual.startsWith('avisado');
        if (statusFilter === 'vencido') return v.status_mes_atual === 'vencido';

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'nome') {
          return nomeDoCliente(a).localeCompare(nomeDoCliente(b));
        }
        if (sortBy === 'valor') {
          return Number(b.valor) - Number(a.valor);
        }
        return (a.data_vencimento_atual || '').localeCompare(b.data_vencimento_atual || '');
      });
  }, [vendas, search, statusFilter, sortBy]);

  const filteredPagamentos = useMemo(() => {
    const term = normalizeSearch(search);
    if (!term) return pagamentos;
    return pagamentos.filter(
      (p) => normalizeSearch(p.cliente_nome).includes(term) || normalizeSearch(p.descricao).includes(term)
    );
  }, [pagamentos, search]);

  // Recebido no mês corrente (data local de quando o pagamento foi confirmado)
  const recebidoNoMes = useMemo(() => {
    const mesAtual = todayISO().slice(0, 7);
    const doMes = pagamentos.filter((p) => todayISO(new Date(p.data_pagamento)).startsWith(mesAtual));
    return {
      quantidade: doMes.length,
      valor: doMes.reduce((acc, p) => acc + (Number(p.valor) || 0), 0),
    };
  }, [pagamentos]);

  const totals = useMemo(() => {
    let sumParcelas = 0;
    let sumTotalVendas = 0;
    let countPendentes = 0;
    let countAvisados = 0;
    let countVencidos = 0;
    let valorEmAberto = 0;

    vendas.forEach((v) => {
      const vParcela = Number(v.valor) || 0;
      const vTotal = Number(v.valor_total) || vParcela * (v.total_parcelas || 1);
      sumParcelas += vParcela;
      sumTotalVendas += vTotal;

      if (v.status_mes_atual !== 'pago') {
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


  // Venda parada tem selo próprio: pausar não pode ser percebido só por a linha ficar apagada
  const getSituacao = (v: Venda, quitada: boolean) =>
    v.ativo ? (
      getStatusBadge(v.status_mes_atual)
    ) : quitada || v.status_mes_atual === 'pago' ? (
      <span className="badge badge-pago">
        <span className="status-dot dot-success" aria-hidden="true" />
        Quitada
      </span>
    ) : (
      <span className="badge" title="Esta venda não recebe avisos. Reative em Editar.">
        <span className="status-dot dot-neutral" aria-hidden="true" />
        Pausada
      </span>
    );

  const parcelasEmAberto = totals.countPendentes + totals.countAvisados + totals.countVencidos;
  const showPagamentos = statusFilter === 'pago';
  const somaPagamentosFiltrados = filteredPagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const somaValorFiltrado = filteredVendas.reduce((acc, v) => acc + (Number(v.valor) || 0), 0);
  const somaTotalFiltrado = filteredVendas.reduce(
    (acc, v) => acc + (Number(v.valor_total) || Number(v.valor) * (v.total_parcelas || 1)),
    0
  );

  const filtrando = Boolean(search.trim()) || statusFilter !== 'todos';
  const listaVazia = !hasLoaded ? (
    loadError ? (
      <EmptyState title="Sem dados para mostrar" text="A consulta falhou. Use “Tentar de novo” acima." />
    ) : (
      <EmptyState title="Carregando vendas..." />
    )
  ) : filtrando ? (
    <EmptyState
      title="Nenhuma venda com esse filtro"
      text="Nada corresponde à busca ou ao filtro escolhido."
      action={
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setSearch('');
            setStatusFilter('todos');
          }}
        >
          Limpar busca e filtros
        </button>
      }
    />
  ) : (
    <EmptyState
      title="Nenhuma venda cadastrada"
      text="Cadastre a primeira venda para começar a acompanhar os pagamentos."
      action={
        <button className="btn btn-primary btn-sm" onClick={() => onOpenNovaVendaModal()}>
          <Plus size={14} /> Nova venda
        </button>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Clientes e vendas"
        subtitle={
          hasLoaded
            ? `${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'} · ${totals.totalRegistros} ${
                totals.totalRegistros === 1 ? 'venda' : 'vendas'
              }`
            : undefined
        }
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchData()} disabled={loading}>
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

      {loadError && (
        <div className="alert alert-danger" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            <strong>Não foi possível carregar as vendas.</strong>{' '}
            {hasLoaded
              ? 'O que aparece abaixo é de antes da falha e pode estar desatualizado.'
              : 'Seus dados não foram apagados: é só a consulta que falhou.'}{' '}
            {loadError}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Tentar de novo
          </button>
        </div>
      )}

      {/* Indicadores (os clicáveis filtram a lista) */}
      <div className="grid-cards">
        <StatTile
          label="Em aberto"
          value={hasLoaded ? formatBRL(totals.valorEmAberto) : '—'}
          hint={
            hasLoaded ? `${parcelasEmAberto} ${parcelasEmAberto === 1 ? 'parcela a receber' : 'parcelas a receber'}` : undefined
          }
        />
        <StatTile
          label="Vencidas"
          value={hasLoaded ? totals.countVencidos : '—'}
          hint={!hasLoaded ? undefined : totals.countVencidos > 0 ? 'Ver quem cobrar' : 'Nenhuma parcela atrasada'}
          tone={totals.countVencidos > 0 ? 'danger' : 'neutral'}
          onClick={() => setStatusFilter('vencido')}
        />
        <StatTile
          label="Recebido no mês"
          value={hasLoaded ? formatBRL(recebidoNoMes.valor) : '—'}
          hint={
            hasLoaded
              ? `${recebidoNoMes.quantidade} ${
                  recebidoNoMes.quantidade === 1 ? 'pagamento confirmado' : 'pagamentos confirmados'
                }`
              : undefined
          }
          tone={recebidoNoMes.quantidade > 0 ? 'success' : 'neutral'}
          onClick={() => setStatusFilter('pago')}
        />
        <StatTile
          label="Clientes"
          value={hasLoaded ? clientes.length : '—'}
          hint={
            hasLoaded
              ? `${totals.totalRegistros} ${totals.totalRegistros === 1 ? 'venda registrada' : 'vendas registradas'}`
              : undefined
          }
        />
      </div>

      {/* Tabela Principal Estilo Excel */}
      <div className="excel-wrapper">
        <div className="excel-toolbar">
          <div className="excel-search-box">
            <Search size={15} className="search-icon" aria-hidden="true" />
            <input
              type="search"
              className="form-input search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, WhatsApp ou produto"
              aria-label="Buscar cliente, WhatsApp ou produto"
            />
            {search && (
              <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Limpar busca">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="excel-filters">
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'todos' ? 'active' : ''}`}
              onClick={() => setStatusFilter('todos')}
              aria-pressed={statusFilter === 'todos'}
            >
              <span>Todas</span>
              <span className="excel-filter-count">{totals.totalRegistros}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'pendente' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pendente')}
              aria-pressed={statusFilter === 'pendente'}
            >
              <span>Pendentes</span>
              <span className="excel-filter-count">{totals.countPendentes}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'avisado' ? 'active' : ''}`}
              onClick={() => setStatusFilter('avisado')}
              aria-pressed={statusFilter === 'avisado'}
            >
              <span>Avisados</span>
              <span className="excel-filter-count">{totals.countAvisados}</span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'vencido' ? 'active' : ''}`}
              onClick={() => setStatusFilter('vencido')}
              aria-pressed={statusFilter === 'vencido'}
            >
              <span>Vencidos</span>
              <span className={`excel-filter-count ${totals.countVencidos > 0 ? 'has-alert' : ''}`}>
                {totals.countVencidos}
              </span>
            </button>
            <button
              type="button"
              className={`excel-filter-btn ${statusFilter === 'pago' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pago')}
              aria-pressed={statusFilter === 'pago'}
            >
              <span>Pagos</span>
              <span className="excel-filter-count">{pagamentos.length}</span>
            </button>
          </div>

          {!showPagamentos && (
            <label className="sort-control">
              <span>Ordenar</span>
              <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                <option value="vencimento">Vencimento mais próximo</option>
                <option value="nome">Cliente (A-Z)</option>
                <option value="valor">Maior valor</option>
              </select>
            </label>
          )}
        </div>

        {/* Pagos: o que já foi recebido (a venda em si segue na lista, no ciclo seguinte) */}
        {showPagamentos && (
          <div className="excel-table-container">
            <table className="excel-table stack-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Venda</th>
                  <th style={{ textAlign: 'center' }}>Parcela</th>
                  <th className="num">Valor recebido</th>
                  <th>Vencimento</th>
                  <th>Pago em</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {!hasLoaded ? (
                  <tr className="is-plain">
                    <td colSpan={7} className="stack-full">
                      <EmptyState title="Carregando pagamentos..." />
                    </td>
                  </tr>
                ) : filteredPagamentos.length === 0 ? (
                  <tr className="is-plain">
                    <td colSpan={7} className="stack-full">
                      <EmptyState
                        title="Nenhum pagamento recebido"
                        text={
                          search
                            ? 'Nenhum pagamento corresponde à busca.'
                            : 'Ao tocar em "Marcar pago" em uma venda, o pagamento aparece aqui.'
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredPagamentos.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Cliente" className="cell-title">
                        {p.cliente_nome || 'Cliente desconhecido'}
                      </td>
                      <td data-label="Venda">{p.descricao || '-'}</td>
                      <td data-label="Parcela" style={{ textAlign: 'center' }}>
                        {p.parcela && p.total_parcelas ? (
                          <span className="badge">
                            {p.parcela}/{p.total_parcelas}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>-</span>
                        )}
                      </td>
                      <td data-label="Valor recebido" className="num cell-title">
                        {formatBRL(p.valor)}
                      </td>
                      <td data-label="Vencimento">{formatDateBR(p.vencimento)}</td>
                      <td data-label="Pago em">
                        <span className="badge badge-pago">
                          <span className="status-dot dot-success" aria-hidden="true" />
                          {formatDateBR(todayISO(new Date(p.data_pagamento)))}
                        </span>
                      </td>
                      <td className={p.pode_desfazer ? 'stack-full' : 'stack-hide'} style={{ textAlign: 'right' }}>
                        <div className="cell-actions">
                          {p.pode_desfazer ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setUndoTarget(p)}
                              disabled={undoingId === p.id}
                              title="Marcou como pago por engano? Volta a parcela para em aberto"
                            >
                              <Undo2 size={14} />
                              {undoingId === p.id ? 'Desfazendo...' : 'Desfazer'}
                            </button>
                          ) : (
                            <span
                              className="panel-caption"
                              title="Só o pagamento mais recente de cada venda pode ser desfeito"
                            >
                              -
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {filteredPagamentos.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      Total de {filteredPagamentos.length}{' '}
                      {filteredPagamentos.length === 1 ? 'pagamento' : 'pagamentos'}
                    </td>
                    <td className="num">{formatBRL(somaPagamentosFiltrados)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Planilha (computador e tablet) */}
        {!showPagamentos && (
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
              {filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan={8}>{listaVazia}</td>
                </tr>
              ) : (
                filteredVendas.map((v) => {
                  const isParcelado = Boolean(v.total_parcelas && v.total_parcelas > 1);
                  const valorTotalCalc = v.valor_total || Number(v.valor) * (v.total_parcelas || 1);
                  const isVencido = v.status_mes_atual === 'vencido';
                  const isQuitada = isParcelado && Boolean(v.parcela_atual && v.parcela_atual >= v.total_parcelas!);

                  return (
                    <tr key={v.id} className={isVencido && v.ativo ? 'row-vencido' : ''}>
                      <td>
                        {v.cliente ? (
                          <button
                            type="button"
                            className="cell-title-btn"
                            onClick={() => onEditCliente(v.cliente!)}
                            title="Abrir o cadastro do cliente"
                          >
                            {v.cliente.nome}
                          </button>
                        ) : (
                          <span className="cell-title">{nomeDoCliente(v) || 'Cliente desconhecido'}</span>
                        )}
                        {!v.cliente && (
                          <button
                            type="button"
                            className="link-btn nowrap"
                            onClick={() => onCadastrarClienteDaVenda(v)}
                            title="Este cliente não tem cadastro e não recebe avisos pelo WhatsApp"
                          >
                            <UserPlus size={11} />
                            Sem cadastro · Cadastrar
                          </button>
                        )}
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

                      <td>{v.descricao}</td>

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

                      <td>{getSituacao(v, isQuitada)}</td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="cell-actions">
                          {v.ativo && v.status_mes_atual !== 'pago' && (
                            <button
                              className="btn btn-pay btn-sm"
                              onClick={() => setPayTarget(v)}
                              disabled={payingVendaId === v.id}
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
                            aria-label={`Histórico de mensagens de ${nomeDoCliente(v)}`}
                          >
                            <History size={15} />
                          </button>

                          <button
                            type="button"
                            className="table-action-btn"
                            onClick={() => onEditVenda(v)}
                            title={v.ativo ? 'Editar ou pausar a venda' : 'Editar ou reativar a venda'}
                            aria-label={`Editar a venda de ${nomeDoCliente(v)}`}
                          >
                            <Edit2 size={15} />
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

        )}

        {/* Cartões (celular) */}
        {!showPagamentos && (
        <div className="mobile-cards-view">
          {filteredVendas.length === 0 ? (
            listaVazia
          ) : (
            <>
              {filteredVendas.map((v, idx) => {
                const isParcelado = Boolean(v.total_parcelas && v.total_parcelas > 1);
                const valorTotalCalc = v.valor_total || Number(v.valor) * (v.total_parcelas || 1);
                const isVencido = v.status_mes_atual === 'vencido';
                const isPago = v.status_mes_atual === 'pago';
                const isAvisado = v.status_mes_atual.startsWith('avisado');
                const isQuitada = isParcelado && Boolean(v.parcela_atual && v.parcela_atual >= v.total_parcelas!);

                return (
                  <div
                    key={v.id}
                    className={`mobile-record-card ${
                      !v.ativo ? '' : isVencido ? 'card-vencido' : isPago ? 'card-pago' : isAvisado ? 'card-avisado' : ''
                    }`}
                  >
                    {/* Quem e o quê */}
                    <div className="mobile-card-header">
                      <div className="mobile-card-title-group">
                        <div className="client-avatar-badge" aria-hidden="true">
                          {nomeDoCliente(v) ? nomeDoCliente(v).slice(0, 2).toUpperCase() : `#${idx + 1}`}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          {v.cliente ? (
                            <button
                              type="button"
                              className="cell-title-btn mobile-card-name"
                              onClick={() => onEditCliente(v.cliente!)}
                            >
                              {v.cliente.nome}
                            </button>
                          ) : (
                            <span className="mobile-card-name">{nomeDoCliente(v) || 'Cliente desconhecido'}</span>
                          )}
                          <div className="list-row-sub">{v.descricao}</div>
                        </div>
                      </div>

                      {getSituacao(v, isQuitada)}
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
                        ) : !v.cliente ? (
                          <button type="button" className="link-btn nowrap" onClick={() => onCadastrarClienteDaVenda(v)}>
                            <UserPlus size={12} />
                            Sem cadastro · Cadastrar
                          </button>
                        ) : (
                          <span>Sem WhatsApp</span>
                        )}

                        <span>
                          {isParcelado ? `Total ${formatBRL(valorTotalCalc)}` : 'À vista'}
                        </span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="mobile-card-actions">
                      {v.ativo && !isPago ? (
                        <button
                          className="btn btn-pay"
                          style={{ flex: 1 }}
                          onClick={() => setPayTarget(v)}
                          disabled={payingVendaId === v.id}
                        >
                          <Check size={16} />
                          {payingVendaId === v.id ? 'Salvando...' : 'Marcar pago'}
                        </button>
                      ) : (
                        <span className="figure-label" style={{ flex: 1 }}>
                          {isPago || isQuitada ? 'Nada a receber' : 'Sem avisos. Reative em Editar.'}
                        </span>
                      )}

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => onOpenHistoricoModal(v)}
                          aria-label={`Histórico de mensagens de ${nomeDoCliente(v)}`}
                        >
                          <History size={16} />
                        </button>

                        <button
                          type="button"
                          className="table-action-btn"
                          onClick={() => onEditVenda(v)}
                          aria-label={`Editar a venda de ${nomeDoCliente(v)}`}
                        >
                          <Edit2 size={16} />
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
        )}
      </div>

      <ConfirmDialog
        open={payTarget !== null}
        title="Confirmar pagamento"
        confirmLabel="Confirmar pagamento"
        confirmClassName="btn-pay"
        confirmIcon={<Check size={16} />}
        busy={payingVendaId !== null}
        onConfirm={confirmPayment}
        onCancel={() => setPayTarget(null)}
      >
        {payTarget && (
          <>
            <div className="confirm-who">{nomeDoCliente(payTarget) || 'Cliente desconhecido'}</div>
            <div className="confirm-what">
              {[payTarget.descricao, parcelaDe(payTarget)].filter(Boolean).join(' · ')}
            </div>
            <div className="confirm-value">{formatBRL(payTarget.valor)}</div>
            <div className="confirm-note">Vencimento em {formatDateBR(payTarget.data_vencimento_atual)}</div>
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={undoTarget !== null}
        title="Desfazer pagamento"
        confirmLabel="Desfazer pagamento"
        busyLabel="Desfazendo..."
        confirmClassName="btn-danger"
        confirmIcon={<Undo2 size={16} />}
        busy={undoingId !== null}
        onConfirm={() => undoTarget && undoPayment(undoTarget.id, undoTarget.cliente_nome || 'cliente')}
        onCancel={() => setUndoTarget(null)}
      >
        {undoTarget && (
          <>
            <div className="confirm-who">{undoTarget.cliente_nome || 'Cliente desconhecido'}</div>
            <div className="confirm-what">
              {[
                undoTarget.descricao,
                undoTarget.parcela && undoTarget.total_parcelas
                  ? `Parcela ${undoTarget.parcela} de ${undoTarget.total_parcelas}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <div className="confirm-value">{formatBRL(undoTarget.valor)}</div>
            <div className="confirm-note">
              A parcela volta a ficar em aberto, com vencimento em {formatDateBR(undoTarget.vencimento)}.
            </div>
          </>
        )}
      </ConfirmDialog>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
