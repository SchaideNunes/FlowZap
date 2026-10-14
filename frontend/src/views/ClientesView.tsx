import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  UserPlus,
  Plus,
  Edit2,
  History,
  Phone,
  Check,
  X,
  RefreshCw,
  Undo2,
  AlertTriangle,
  ChevronDown,
  StickyNote,
} from 'lucide-react';
import { Cliente, PagamentoRecebido, Venda } from '../types/index.js';
import { api } from '../services/api.js';
import { formatFullWhatsApp } from '../utils/phone.js';
import { extractErrorMessage } from '../utils/error.js';
import { formatBRL, formatDateBR, normalizeSearch, todayISO } from '../utils/format.js';
import {
  GrupoCliente,
  agruparPorCliente,
  atrasoDaVenda,
  ordenarPorUrgencia,
  textoDaUrgencia,
} from '../utils/clientes-agrupados.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatTile } from '../components/ui/StatTile.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';
import { Toast, ToastData } from '../components/ui/Toast.js';

interface ClientesViewProps {
  onOpenNovoClienteModal: () => void;
  onEditCliente: (cliente: Cliente) => void;
  /** Cadastra quem comprou sem cadastro e passa as vendas dele para o cliente novo. */
  onCadastrarClienteDaVenda: (vendas: Venda[]) => void;
  onOpenNovaVendaModal: (clienteId?: number) => void;
  onEditVenda: (venda: Venda) => void;
  onOpenHistoricoModal: (venda: Venda) => void;
}

type Filtro = 'devendo' | 'vencidos' | 'todos' | 'pago';
type Ordem = 'urgencia' | 'nome' | 'valor';

const PAGINA = 50;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

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
  // Falha ao carregar não pode parecer "nenhum cliente": tem estado e mensagem próprios
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('devendo');
  const [ordem, setOrdem] = useState<Ordem>('urgencia');
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  // Vendas com a observação à mostra
  const [notasAbertas, setNotasAbertas] = useState<Set<number>>(new Set());
  const [limite, setLimite] = useState(PAGINA);

  const [payingVendaId, setPayingVendaId] = useState<number | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);
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
        // A lista de recebidos não pode impedir a tela de abrir
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

  const hoje = todayISO();
  const nomeDaVenda = (v: Venda) => v.cliente?.nome || v.cliente_avulso || 'cliente';
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
    const nome = nomeDaVenda(venda);

    setPayingVendaId(venda.id);
    try {
      const res = await api.patch(`/vendas/${venda.id}/pago`);
      const atualizada: Venda | undefined = res.data?.venda;
      setPayTarget(null);

      // A venda segue com o cliente, já no ciclo seguinte: dizer para onde o pagamento foi
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

  const grupos = useMemo(() => agruparPorCliente(clientes, vendas, hoje), [clientes, vendas, hoje]);

  const resumo = useMemo(() => {
    const devendo = grupos.filter((g) => g.abertas.length > 0);
    const vencidos = devendo.filter((g) => g.urgencia === 'vencido');
    const mesAtual = hoje.slice(0, 7);
    const doMes = pagamentos.filter((p) => todayISO(new Date(p.data_pagamento)).startsWith(mesAtual));
    return {
      devendo: devendo.length,
      vencidos: vencidos.length,
      valorEmAberto: devendo.reduce((acc, g) => acc + g.totalAberto, 0),
      valorVencido: vencidos.reduce(
        (acc, g) => acc + g.abertas.filter((v) => atrasoDaVenda(v, hoje) > 0).reduce((s, v) => s + Number(v.valor), 0),
        0
      ),
      recebidoMes: doMes.reduce((acc, p) => acc + (Number(p.valor) || 0), 0),
      pagamentosMes: doMes.length,
    };
  }, [grupos, pagamentos, hoje]);

  const gruposVisiveis = useMemo(() => {
    // Sem acento e sem a máscara do telefone: "joao" acha "João", "(75) 99150" acha o número
    const term = normalizeSearch(search);
    const digits = term.replace(/\D/g, '');

    return grupos
      .filter((g) => {
        if (filtro === 'devendo' && g.abertas.length === 0) return false;
        if (filtro === 'vencidos' && g.urgencia !== 'vencido') return false;
        if (!term) return true;
        return (
          normalizeSearch(g.nome).includes(term) ||
          (digits.length >= 3 && (g.cliente?.whatsapp || '').includes(digits)) ||
          g.vendas.some((v) => normalizeSearch(v.descricao).includes(term))
        );
      })
      .sort((a, b) => {
        if (ordem === 'nome') return a.nome.localeCompare(b.nome);
        if (ordem === 'valor') return b.totalAberto - a.totalAberto || a.nome.localeCompare(b.nome);
        return ordenarPorUrgencia(a, b);
      });
  }, [grupos, search, filtro, ordem]);

  const pagamentosVisiveis = useMemo(() => {
    const term = normalizeSearch(search);
    if (!term) return pagamentos;
    return pagamentos.filter(
      (p) => normalizeSearch(p.cliente_nome).includes(term) || normalizeSearch(p.descricao).includes(term)
    );
  }, [pagamentos, search]);

  // Trocar a busca ou o filtro volta a lista para o começo
  useEffect(() => {
    setLimite(PAGINA);
  }, [search, filtro, ordem]);

  const alternar = (key: string) =>
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Estado da parcela: ponto colorido + rótulo (a cor nunca vai sozinha)
  const selo = (classe: string, ponto: string, texto: string, dica?: string) => (
    <span className={`badge ${classe}`} title={dica}>
      <span className={`status-dot ${ponto}`} aria-hidden="true" />
      {texto}
    </span>
  );

  const seloDaVenda = (v: Venda) => {
    const quitada = Boolean(v.total_parcelas && v.total_parcelas > 1 && (v.parcela_atual || 1) >= v.total_parcelas);
    if (!v.ativo) {
      return quitada || v.status_mes_atual === 'pago'
        ? selo('badge-pago', 'dot-success', 'Quitada')
        : selo('', 'dot-neutral', 'Pausada', 'Esta venda não recebe avisos. Reative em Editar.');
    }
    const atraso = atrasoDaVenda(v, hoje);
    if (atraso > 0) return selo('badge-vencido', 'dot-danger', `Vencida há ${plural(atraso, 'dia', 'dias')}`);
    switch (v.status_mes_atual) {
      case 'pago':
        return selo('badge-pago', 'dot-success', 'Paga');
      case 'vencido':
        return selo('badge-vencido', 'dot-danger', 'Vence hoje');
      case 'avisado_3d':
      case 'avisado_1d':
        return selo('badge-avisado', 'dot-warning', 'Avisado', 'Já recebeu lembrete pelo WhatsApp neste ciclo');
      default:
        return selo('badge-pendente', 'dot-neutral', 'A vencer');
    }
  };

  const seloDoCliente = (g: GrupoCliente) => {
    const texto = textoDaUrgencia(g);
    if (g.urgencia === 'vencido') return selo('badge-vencido', 'dot-danger', texto);
    if (g.urgencia === 'hoje' || g.urgencia === 'em_breve') return selo('badge-avisado', 'dot-warning', texto);
    return selo('', 'dot-neutral', texto);
  };

  const mostrandoPagos = filtro === 'pago';
  const filtrando = Boolean(search.trim());
  const somaPagamentos = pagamentosVisiveis.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  // Um único resultado já aparece aberto: não faz sentido pedir mais um toque
  const estaAberto = (key: string) => abertos.has(key) || gruposVisiveis.length === 1;

  const listaVazia = !hasLoaded ? (
    loadError ? (
      <EmptyState title="Sem dados para mostrar" text="A consulta falhou. Use “Tentar de novo” acima." />
    ) : (
      <EmptyState title="Carregando clientes..." />
    )
  ) : filtrando ? (
    <EmptyState
      title="Ninguém encontrado"
      text={
        filtro === 'todos'
          ? 'Nenhum cliente corresponde à busca.'
          : 'Nenhum cliente deste filtro corresponde à busca. Ele pode estar em “Todos”.'
      }
      action={
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setSearch('');
            setFiltro('todos');
          }}
        >
          Limpar a busca e ver todos
        </button>
      }
    />
  ) : grupos.length === 0 ? (
    <EmptyState
      title="Nenhum cliente cadastrado"
      text="Cadastre a primeira venda para começar a acompanhar os pagamentos."
      action={
        <button className="btn btn-primary btn-sm" onClick={() => onOpenNovaVendaModal()}>
          <Plus size={14} /> Nova venda
        </button>
      }
    />
  ) : filtro === 'vencidos' ? (
    <EmptyState title="Ninguém em atraso" text="Nenhum cliente está com parcela vencida." />
  ) : (
    <EmptyState
      title="Ninguém devendo"
      text="Todas as parcelas estão pagas. Os clientes continuam em “Todos”."
      action={
        <button className="btn btn-secondary btn-sm" onClick={() => setFiltro('todos')}>
          Ver todos os clientes
        </button>
      }
    />
  );

  const FILTROS: { id: Filtro; rotulo: string; total: number; alerta?: boolean }[] = [
    { id: 'devendo', rotulo: 'Devendo', total: resumo.devendo },
    { id: 'vencidos', rotulo: 'Vencidos', total: resumo.vencidos, alerta: resumo.vencidos > 0 },
    { id: 'todos', rotulo: 'Todos', total: grupos.length },
    { id: 'pago', rotulo: 'Pagos', total: pagamentos.length },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={
          hasLoaded ? `${plural(grupos.length, 'cliente', 'clientes')} · ${plural(vendas.length, 'venda', 'vendas')}` : undefined
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
            <strong>Não foi possível carregar os clientes.</strong>{' '}
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

      {/* Indicadores (todos levam à lista correspondente) */}
      <div className="grid-cards">
        <StatTile
          label="Em aberto"
          value={hasLoaded ? formatBRL(resumo.valorEmAberto) : '—'}
          hint={hasLoaded ? plural(resumo.devendo, 'cliente devendo', 'clientes devendo') : undefined}
          onClick={() => setFiltro('devendo')}
        />
        <StatTile
          label="Vencido"
          value={hasLoaded ? formatBRL(resumo.valorVencido) : '—'}
          hint={
            !hasLoaded
              ? undefined
              : resumo.vencidos > 0
                ? plural(resumo.vencidos, 'cliente em atraso', 'clientes em atraso')
                : 'Ninguém em atraso'
          }
          tone={resumo.vencidos > 0 ? 'danger' : 'neutral'}
          onClick={() => setFiltro('vencidos')}
        />
        <StatTile
          label="Recebido no mês"
          value={hasLoaded ? formatBRL(resumo.recebidoMes) : '—'}
          hint={hasLoaded ? plural(resumo.pagamentosMes, 'pagamento confirmado', 'pagamentos confirmados') : undefined}
          tone={resumo.pagamentosMes > 0 ? 'success' : 'neutral'}
          onClick={() => setFiltro('pago')}
        />
        <StatTile
          label="Clientes"
          value={hasLoaded ? grupos.length : '—'}
          hint={hasLoaded ? plural(vendas.length, 'venda registrada', 'vendas registradas') : undefined}
          onClick={() => setFiltro('todos')}
        />
      </div>

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

          <div className="excel-filters filters-fit" role="group" aria-label="Quais clientes mostrar">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`excel-filter-btn ${filtro === f.id ? 'active' : ''}`}
                onClick={() => setFiltro(f.id)}
                aria-pressed={filtro === f.id}
              >
                <span>{f.rotulo}</span>
                <span className={`excel-filter-count ${f.alerta ? 'has-alert' : ''}`}>{f.total}</span>
              </button>
            ))}
          </div>

          {!mostrandoPagos && (
            <label className="sort-control">
              <span>Ordenar</span>
              <select className="form-select" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
                <option value="urgencia">Quem cobrar primeiro</option>
                <option value="nome">Nome (A-Z)</option>
                <option value="valor">Maior valor em aberto</option>
              </select>
            </label>
          )}
        </div>

        {/* Pagos: o que já foi recebido, com a opção de desfazer */}
        {mostrandoPagos && (
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
                      <EmptyState title={loadError ? 'Sem dados para mostrar' : 'Carregando pagamentos...'} />
                    </td>
                  </tr>
                ) : pagamentosVisiveis.length === 0 ? (
                  <tr className="is-plain">
                    <td colSpan={7} className="stack-full">
                      <EmptyState
                        title="Nenhum pagamento recebido"
                        text={
                          filtrando
                            ? 'Nenhum pagamento corresponde à busca.'
                            : 'Ao marcar uma parcela como paga, o pagamento aparece aqui.'
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  pagamentosVisiveis.map((p) => (
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
                          <span className="text-dim">-</span>
                        )}
                      </td>
                      <td data-label="Valor recebido" className="num cell-title">
                        {formatBRL(p.valor)}
                      </td>
                      <td data-label="Vencimento">{formatDateBR(p.vencimento)}</td>
                      <td data-label="Pago em">
                        {selo('badge-pago', 'dot-success', formatDateBR(todayISO(new Date(p.data_pagamento))))}
                      </td>
                      <td className={p.pode_desfazer ? 'stack-full' : 'stack-hide'} style={{ textAlign: 'right' }}>
                        <div className="cell-actions">
                          {p.pode_desfazer ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setUndoTarget(p)}
                              disabled={undoingId === p.id}
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

              {pagamentosVisiveis.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} className="text-muted">
                      Total de {plural(pagamentosVisiveis.length, 'pagamento', 'pagamentos')}
                    </td>
                    <td className="num">{formatBRL(somaPagamentos)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Clientes: cada linha é uma pessoa; tocar abre as vendas dela */}
        {!mostrandoPagos && (
          <div className="client-list">
            {gruposVisiveis.length === 0 ? (
              listaVazia
            ) : (
              <>
                <div className="client-list-head" aria-hidden="true">
                  <span>Cliente</span>
                  <span>Em aberto</span>
                  <span className="num">Valor</span>
                  <span>Situação</span>
                </div>

                {gruposVisiveis.slice(0, limite).map((g) => {
                  const aberto = estaAberto(g.key);
                  const idPainel = `vendas-${g.key.replace(/[^a-zA-Z0-9-]/g, '-')}`;
                  const primeira = g.abertas[0] || g.vendas[0];

                  return (
                    <section key={g.key} className={`client-row ${aberto ? 'is-open' : ''}`}>
                      <button
                        type="button"
                        className="client-row-toggle"
                        onClick={() => alternar(g.key)}
                        aria-expanded={aberto}
                        aria-controls={idPainel}
                      >
                        <span className="client-row-name">
                          <ChevronDown size={16} className="client-row-chevron" aria-hidden="true" />
                          <span className="client-row-name-text">
                            <strong>{g.nome}</strong>
                            <span className="client-row-sub">
                              {g.cliente?.whatsapp
                                ? formatFullWhatsApp(g.cliente.whatsapp)
                                : g.cliente
                                  ? 'Sem WhatsApp'
                                  : 'Sem cadastro'}
                            </span>
                          </span>
                        </span>

                        <span className="client-row-count">
                          {g.abertas.length > 0
                            ? g.abertas.length === 1 && primeira
                              ? primeira.descricao
                              : plural(g.abertas.length, 'parcela', 'parcelas')
                            : plural(g.vendas.length, 'venda', 'vendas')}
                        </span>

                        <span className="client-row-value num">
                          {g.abertas.length > 0 ? formatBRL(g.totalAberto) : '—'}
                        </span>

                        <span className="client-row-status">{seloDoCliente(g)}</span>
                      </button>

                      {aberto && (
                        <div className="client-panel" id={idPainel}>
                          {g.vendas.length === 0 ? (
                            <p className="client-panel-empty">Este cliente ainda não tem vendas.</p>
                          ) : (
                            <ul className="sale-list">
                              {g.vendas.map((v) => (
                                <li key={v.id} className={`sale-row ${v.ativo ? '' : 'is-inactive'}`}>
                                  <span className="sale-desc">
                                    {v.descricao}
                                    <span className="sale-meta">{parcelaDe(v) || 'Parcela única'}</span>
                                    {v.observacoes && (
                                      <button
                                        type="button"
                                        className="link-btn sale-note-toggle"
                                        onClick={() =>
                                          setNotasAbertas((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(v.id)) next.delete(v.id);
                                            else next.add(v.id);
                                            return next;
                                          })
                                        }
                                        aria-expanded={notasAbertas.has(v.id)}
                                        aria-controls={`nota-${v.id}`}
                                      >
                                        <StickyNote size={12} aria-hidden="true" />
                                        {notasAbertas.has(v.id) ? 'Esconder observação' : 'Ver observação'}
                                      </button>
                                    )}
                                  </span>
                                  <span className="sale-value num">{formatBRL(v.valor)}</span>
                                  <span className="sale-due">
                                    <span className="sale-due-label">Vence </span>
                                    {formatDateBR(v.data_vencimento_atual)}
                                  </span>
                                  <span className="sale-status">{seloDaVenda(v)}</span>
                                  <span className="sale-actions">
                                    {v.ativo && v.status_mes_atual !== 'pago' && (
                                      <button
                                        type="button"
                                        className="btn btn-pay btn-sm sale-pay"
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
                                      aria-label={`Histórico de mensagens de ${v.descricao}`}
                                    >
                                      <History size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      className="table-action-btn"
                                      onClick={() => onEditVenda(v)}
                                      title={v.ativo ? 'Editar ou pausar a venda' : 'Editar ou reativar a venda'}
                                      aria-label={`Editar a venda ${v.descricao}`}
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                  </span>
                                  {v.observacoes && notasAbertas.has(v.id) && (
                                    <p className="sale-note" id={`nota-${v.id}`}>
                                      {v.observacoes}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="client-panel-foot">
                            {g.cliente ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => onOpenNovaVendaModal(g.cliente!.id)}
                                >
                                  <Plus size={14} />
                                  Nova venda para {g.nome.split(' ')[0]}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => onEditCliente(g.cliente!)}
                                >
                                  <Edit2 size={14} />
                                  Editar cadastro
                                </button>
                                {g.cliente.whatsapp && (
                                  <a
                                    className="btn btn-ghost btn-sm"
                                    href={`https://wa.me/${g.cliente.whatsapp}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Phone size={14} />
                                    Abrir WhatsApp
                                  </a>
                                )}
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => onCadastrarClienteDaVenda(g.vendas)}
                                >
                                  <UserPlus size={14} />
                                  Cadastrar {g.nome.split(' ')[0]}
                                </button>
                                <span className="panel-caption">Sem cadastro, não recebe avisos pelo WhatsApp.</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}

                {gruposVisiveis.length > limite && (
                  <div className="client-list-more">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLimite((n) => n + PAGINA)}>
                      Mostrar mais {Math.min(PAGINA, gruposVisiveis.length - limite)} de{' '}
                      {gruposVisiveis.length - limite} restantes
                    </button>
                  </div>
                )}
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
            <div className="confirm-who">{nomeDaVenda(payTarget)}</div>
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
