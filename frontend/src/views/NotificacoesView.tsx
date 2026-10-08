import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  AlertTriangle,
  Send,
  CheckCircle2,
  Calendar,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Check,
  History,
  Phone,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from 'lucide-react';
import {
  CentralNotificacoesData,
  ReminderPreviewItem,
  OverdueReminderItem,
  EnviadoItem,
  Venda,
  WhatsAppStatus,
} from '../types/index.js';
import { api } from '../services/api.js';
import { formatFullWhatsApp } from '../utils/phone.js';
import { extractErrorMessage } from '../utils/error.js';
import { summarizeSede } from '../utils/sede.js';

interface NotificacoesViewProps {
  whatsAppInfo: WhatsAppStatus;
  onOpenWhatsAppModal: () => void;
  onOpenHistoricoModal: (venda: Venda) => void;
}

export const NotificacoesView: React.FC<NotificacoesViewProps> = ({
  whatsAppInfo,
  onOpenWhatsAppModal,
  onOpenHistoricoModal,
}) => {
  const whatsAppStatus = whatsAppInfo.state;
  // Painel online (ex.: Vercel): não envia mensagens, só mostra o estado da máquina-sede
  const isRemotePanel = whatsAppInfo.available === false;
  const sede = summarizeSede(whatsAppInfo);

  const [data, setData] = useState<CentralNotificacoesData>({
    agendadosHoje: [],
    emAtraso: [],
    enviadosRecentes: [],
    resumo: {
      totalHoje: 0,
      valorHoje: 0,
      totalAtrasados: 0,
      valorAtrasado: 0,
      totalEnviados: 0,
      totalPagosAposEnvio: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hoje' | 'enviados' | 'atrasados'>('hoje');
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [payingVendaId, setPayingVendaId] = useState<number | null>(null);

  const fetchCentralData = async (shouldAutoSelectTab = false) => {
    setLoading(true);
    try {
      const res = await api.get('/cobrancas/central');
      const centralData: CentralNotificacoesData = res.data;
      setData(centralData);

      if (shouldAutoSelectTab) {
        if (centralData.agendadosHoje.length > 0) {
          setActiveTab('hoje');
        } else if (centralData.enviadosRecentes && centralData.enviadosRecentes.length > 0) {
          setActiveTab('enviados');
        } else if (centralData.emAtraso.length > 0) {
          setActiveTab('atrasados');
        }
      }
    } catch {
      // Falha passageira
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCentralData(true);
  }, []);

  const handleDispatchToday = async () => {
    if (isRemotePanel) {
      alert('Os disparos só podem ser feitos pela máquina-sede. Abra o sistema no computador da loja.');
      return;
    }

    if (data.agendadosHoje.length === 0) {
      alert('Não há cobranças elegíveis para envio hoje.');
      return;
    }

    if (whatsAppStatus !== 'open') {
      const confirm = window.confirm(
        'O WhatsApp não está conectado no momento. Deseja abrir a tela de conexão antes de disparar?'
      );
      if (confirm) onOpenWhatsAppModal();
      return;
    }

    const confirm = window.confirm(
      `Deseja iniciar o disparo sequencial de ${data.agendadosHoje.length} notificações de hoje via WhatsApp?`
    );
    if (!confirm) return;

    setDispatching(true);
    try {
      const res = await api.post('/cobrancas/disparar');
      setFeedbackMsg(
        `Disparo iniciado com sucesso para ${res.data.total} clientes! As mensagens estão sendo enviadas com intervalo anti-ban.`
      );
      setTimeout(() => setFeedbackMsg(null), 6000);
      await fetchCentralData();
      setActiveTab('enviados');
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Erro ao iniciar disparo de notificações.'));
    } finally {
      setDispatching(false);
    }
  };

  const handleMarkAsPaid = async (vendaId: number, nome: string, valor: number) => {
    const confirm = window.confirm(
      `Confirmar recebimento do pagamento de "${nome}" no valor de R$ ${valor.toFixed(2).replace('.', ',')}?`
    );
    if (!confirm) return;

    setPayingVendaId(vendaId);
    try {
      await api.patch(`/vendas/${vendaId}/pago`);
      setFeedbackMsg(`Pagamento de "${nome}" confirmado com sucesso!`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchCentralData();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Erro ao registrar pagamento.'));
    } finally {
      setPayingVendaId(null);
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'lembrete_3d':
        return (
          <span className="badge badge-avisado" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
            <Clock size={12} /> Lembrete (3 dias antes)
          </span>
        );
      case 'lembrete_1d':
        return (
          <span
            className="badge"
            style={{
              whiteSpace: 'nowrap',
              padding: '4px 10px',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.25)',
            }}
          >
            <AlertTriangle size={12} /> Lembrete (Vence Amanhã)
          </span>
        );
      case 'vencido':
        return (
          <span className="badge badge-vencido" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
            <AlertTriangle size={12} /> Vence Hoje / Vencido
          </span>
        );
      default:
        return (
          <span className="badge badge-pendente" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
            Lembrete
          </span>
        );
    }
  };

  const getDelayBadge = (dias: number) => {
    if (dias === 0) {
      return (
        <span className="badge badge-avisado" style={{ whiteSpace: 'nowrap' }}>
          Vence Hoje
        </span>
      );
    }
    if (dias <= 3) {
      return (
        <span
          className="badge"
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#fbbf24',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {dias} {dias === 1 ? 'dia' : 'dias'} de atraso
        </span>
      );
    }
    return (
      <span className="badge badge-vencido" style={{ whiteSpace: 'nowrap' }}>
        {dias} dias de atraso (Atenção)
      </span>
    );
  };

  const formatDateTime = (isoStr?: string) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  };

  const toggleExpand = (id: string) => {
    setExpandedMessageId((prev) => (prev === id ? null : id));
  };

  const totalEnviados = data.enviadosRecentes?.length || 0;
  const totalPagosAposEnvio = data.resumo.totalPagosAposEnvio || 0;

  return (
    <div>
      {/* Top Header */}
      <div className="view-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={22} color="#3b82f6" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.55rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Central de Notificações & Cobranças
              </h2>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
            Acompanhe quem será notificado hoje, os números disparados no último lote e controle os pagamentos.
          </p>
        </div>

        <div className="view-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchCentralData()}
            disabled={loading}
            title="Recarregar dados"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Atualizar
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleDispatchToday}
            disabled={isRemotePanel || dispatching || data.agendadosHoje.length === 0}
            title={isRemotePanel ? 'Os disparos saem pela máquina-sede' : undefined}
            style={{ fontWeight: 600, padding: '0.5rem 1.15rem' }}
          >
            <Send size={15} />
            {dispatching
              ? 'Enfileirando...'
              : `Disparar Notificações de Hoje (${data.agendadosHoje.length})`}
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
          }}
        >
          <CheckCircle2 size={19} />
          {feedbackMsg}
        </div>
      )}

      {/* Cards de KPIs Rápidos */}
      <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
        <div className="card stat-card" style={{ padding: '1.1rem 1.25rem', borderLeft: '3px solid #3b82f6' }}>
          <div className="stat-info">
            <span className="stat-label">NOTIFICAÇÕES PARA HOJE</span>
            <span className="stat-value" style={{ color: '#60a5fa', fontSize: '1.5rem' }}>
              {data.resumo.totalHoje} {data.resumo.totalHoje === 1 ? 'cliente' : 'clientes'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              R$ {data.resumo.valorHoje.toFixed(2).replace('.', ',')} a receber hoje
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            <Clock size={22} color="#3b82f6" />
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '1.1rem 1.25rem', borderLeft: '3px solid #10b981' }}>
          <div className="stat-info">
            <span className="stat-label">ÚLTIMO DISPARO (ENVIADOS)</span>
            <span className="stat-value" style={{ color: '#34d399', fontSize: '1.5rem' }}>
              {totalEnviados} {totalEnviados === 1 ? 'mensagem' : 'mensagens'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              <strong style={{ color: '#34d399' }}>{totalPagosAposEnvio}</strong> já confirmaram pagamento
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <Send size={22} color="#10b981" />
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '1.1rem 1.25rem', borderLeft: '3px solid #ef4444' }}>
          <div className="stat-info">
            <span className="stat-label">EM ATRASO (COBRANÇA ATIVA)</span>
            <span className="stat-value" style={{ color: '#f87171', fontSize: '1.5rem' }}>
              {data.resumo.totalAtrasados} {data.resumo.totalAtrasados === 1 ? 'venda' : 'vendas'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              R$ {data.resumo.valorAtrasado.toFixed(2).replace('.', ',')} vencidos em aberto
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <AlertTriangle size={22} color="#ef4444" />
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '1.1rem 1.25rem', borderLeft: '3px solid #8b5cf6' }}>
          <div className="stat-info">
            <span className="stat-label">{isRemotePanel ? 'MÁQUINA-SEDE' : 'CONEXÃO WHATSAPP'}</span>
            <span className="stat-value" style={{ fontSize: '1.35rem' }}>
              {isRemotePanel ? (
                <span
                  style={{
                    color: sede.tone === 'ok' ? '#34d399' : sede.tone === 'warn' ? '#fbbf24' : sede.tone === 'off' ? '#f87171' : 'var(--text-muted)',
                    fontSize: '1.25rem',
                  }}
                >
                  {sede.short}
                </span>
              ) : whatsAppStatus === 'open' ? (
                <span style={{ color: '#34d399', fontSize: '1.25rem' }}>Conectado</span>
              ) : whatsAppStatus === 'connecting' ? (
                <span style={{ color: '#fbbf24', fontSize: '1.25rem' }}>Conectando...</span>
              ) : (
                <span style={{ color: '#f87171', fontSize: '1.25rem' }}>Desconectado</span>
              )}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {isRemotePanel
                ? 'Envios saem pelo computador da loja'
                : whatsAppStatus === 'open'
                  ? 'Pronto para disparos'
                  : 'Clique para conectar'}
            </span>
          </div>
          <div
            className="stat-icon"
            style={{
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              cursor: isRemotePanel ? 'default' : 'pointer',
            }}
            onClick={isRemotePanel ? undefined : onOpenWhatsAppModal}
            title={isRemotePanel ? sede.detail : undefined}
          >
            <Phone size={22} color="#a78bfa" />
          </div>
        </div>
      </div>

      {/* Wrapper Principal de Notificações */}
      <div className="excel-wrapper">
        {/* Seletor de Abas da Central */}
        <div className="excel-toolbar" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="excel-filters">
            <button
              type="button"
              className={`excel-filter-btn ${activeTab === 'hoje' ? 'active' : ''}`}
              onClick={() => setActiveTab('hoje')}
            >
              <Calendar size={14} />
              <span>Notificações de Hoje</span>
              <span className="excel-filter-count">{data.agendadosHoje.length}</span>
            </button>

            <button
              type="button"
              className={`excel-filter-btn ${activeTab === 'enviados' ? 'active' : ''}`}
              onClick={() => setActiveTab('enviados')}
            >
              <Send size={14} color="#34d399" />
              <span>Enviados no Último Disparo</span>
              <span className="excel-filter-count" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                {totalEnviados}
              </span>
            </button>

            <button
              type="button"
              className={`excel-filter-btn ${activeTab === 'atrasados' ? 'active' : ''}`}
              onClick={() => setActiveTab('atrasados')}
            >
              <AlertTriangle size={14} color={data.emAtraso.length > 0 ? '#f87171' : undefined} />
              <span>Clientes em Atraso</span>
              <span
                className="excel-filter-count"
                style={{ color: data.emAtraso.length > 0 ? '#f87171' : undefined }}
              >
                {data.emAtraso.length}
              </span>
            </button>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            {activeTab === 'hoje'
              ? 'Lembretes programados pela régua automática para envio hoje.'
              : activeTab === 'enviados'
              ? 'Controle dos números notificados: acompanhe quem já pagou e dê baixa rápida.'
              : 'Clientes com parcelas vencidas que exigem atenção na cobrança.'}
          </div>
        </div>

        {/* Conteúdo da Aba 1: Agendados para Hoje */}
        {activeTab === 'hoje' && (
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                  <th style={{ minWidth: '180px' }}>Cliente</th>
                  <th style={{ minWidth: '180px' }}>WhatsApp</th>
                  <th style={{ minWidth: '220px' }}>Venda / Aparelho</th>
                  <th style={{ minWidth: '140px', textAlign: 'center' }}>Tipo do Aviso</th>
                  <th style={{ minWidth: '120px', textAlign: 'right' }}>Valor</th>
                  <th style={{ minWidth: '120px', textAlign: 'center' }}>Vencimento</th>
                  <th style={{ minWidth: '280px' }}>Mensagem Formatada</th>
                  <th style={{ minWidth: '180px', textAlign: 'center' }}>Ações Rápidas</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
                      Carregando notificações agendadas...
                    </td>
                  </tr>
                ) : data.agendadosHoje.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                      <CheckCircle2 size={36} color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                        Nenhuma notificação pendente para envio hoje!
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Todos os clientes do ciclo já foram avisados ou os vencimentos estão agendados para outros dias.
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.agendadosHoje.map((item: ReminderPreviewItem, idx: number) => {
                    const msgKey = `hoje-${item.vendaId}`;
                    const isExpanded = expandedMessageId === msgKey;
                    const encodedMsg = encodeURIComponent(item.mensagem);

                    return (
                      <tr key={item.vendaId}>
                        <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.76rem', fontFamily: 'monospace' }}>
                          {idx + 1}
                        </td>

                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#fff' }}>
                          {item.clienteNome}
                        </td>

                        <td>
                          {item.whatsapp ? (
                            <a
                              href={`https://wa.me/${item.whatsapp}?text=${encodedMsg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="whatsapp-pill-btn"
                              title="Abrir no WhatsApp com mensagem preenchida"
                            >
                              <Phone size={11} />
                              <span>{formatFullWhatsApp(item.whatsapp)}</span>
                              <ExternalLink size={10} style={{ opacity: 0.7 }} />
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>-</span>
                          )}
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{item.descricao || 'Cobrança'}</div>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {getTipoBadge(item.tipo)}
                        </td>

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
                          R$ {Number(item.valor).toFixed(2).replace('.', ',')}
                        </td>

                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
                            <Calendar size={13} color="var(--text-dim)" />
                            {item.dataVencimento}
                          </span>
                        </td>

                        {/* Mensagem com Expansão */}
                        <td>
                          <div
                            style={{
                              background: 'rgba(0, 0, 0, 0.25)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: 'var(--text-muted)',
                              lineHeight: 1.4,
                              maxWidth: '380px',
                            }}
                          >
                            <div
                              style={{
                                whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.mensagem}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleExpand(msgKey)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary)',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                padding: 0,
                                marginTop: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              {isExpanded ? (
                                <>
                                  Recolher <ChevronUp size={11} />
                                </>
                              ) : (
                                <>
                                  Ver mensagem completa <ChevronDown size={11} />
                                </>
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Ações */}
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <a
                              href={`https://wa.me/${item.whatsapp}?text=${encodedMsg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', textDecoration: 'none' }}
                              title="Enviar mensagem agora pelo WhatsApp"
                            >
                              <MessageSquare size={13} /> Enviar
                            </a>

                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleMarkAsPaid(item.vendaId, item.clienteNome, Number(item.valor))}
                              disabled={payingVendaId === item.vendaId}
                              title="Marcar como pago (recebido no balcão)"
                            >
                              <Check size={13} color="var(--primary)" />
                              {payingVendaId === item.vendaId ? 'Salvando...' : 'Pago'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Conteúdo da Aba 2: Enviados no Último Disparo */}
        {activeTab === 'enviados' && (
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                  <th style={{ minWidth: '180px' }}>Cliente</th>
                  <th style={{ minWidth: '180px' }}>WhatsApp Notificado</th>
                  <th style={{ minWidth: '200px' }}>Venda / Aparelho</th>
                  <th style={{ minWidth: '120px', textAlign: 'right' }}>Valor Parcela</th>
                  <th style={{ minWidth: '160px', textAlign: 'center' }}>Data & Hora do Envio</th>
                  <th style={{ minWidth: '140px', textAlign: 'center' }}>Aviso Disparado</th>
                  <th style={{ minWidth: '130px', textAlign: 'center' }}>Status Pagamento</th>
                  <th style={{ minWidth: '220px', textAlign: 'center' }}>Controle & Baixa Rápida</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
                      Carregando histórico de notificações enviadas...
                    </td>
                  </tr>
                ) : !data.enviadosRecentes || data.enviadosRecentes.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                      <Send size={36} color="var(--text-dim)" style={{ margin: '0 auto 12px auto' }} />
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                        Nenhum disparo registrado recentemente
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Assim que você disparar as notificações do dia, os clientes notificados aparecerão nesta lista para controle de pagamento.
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.enviadosRecentes.map((item: EnviadoItem, idx: number) => {
                    const isPago = item.statusMesAtual === 'pago';
                    const msgKey = `env-${item.id}`;
                    const isExpanded = expandedMessageId === msgKey;

                    return (
                      <tr key={item.id} className={isPago ? 'row-pago' : ''}>
                        <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.76rem', fontFamily: 'monospace' }}>
                          {idx + 1}
                        </td>

                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#fff' }}>
                          {item.clienteNome}
                        </td>

                        <td>
                          {item.whatsapp ? (
                            <a
                              href={`https://wa.me/${item.whatsapp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="whatsapp-pill-btn"
                              title="Abrir conversa no WhatsApp Web"
                            >
                              <Phone size={11} />
                              <span>{formatFullWhatsApp(item.whatsapp)}</span>
                              <ExternalLink size={10} style={{ opacity: 0.7 }} />
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>-</span>
                          )}
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{item.descricao || 'Cobrança'}</div>
                        </td>

                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isPago ? '#34d399' : '#fff',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          R$ {Number(item.valor).toFixed(2).replace('.', ',')}
                        </td>

                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                          {formatDateTime(item.dataEnvio)}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {getTipoBadge(item.tipo)}
                        </td>

                        {/* Status de Pagamento */}
                        <td style={{ textAlign: 'center' }}>
                          {isPago ? (
                            <span className="badge badge-pago" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
                              <Check size={11} /> Pago
                            </span>
                          ) : (
                            <span className="badge badge-avisado" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }}>
                              Aguardando
                            </span>
                          )}
                        </td>

                        {/* Ações de Controle & Baixa */}
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {!isPago ? (
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600 }}
                                onClick={() => handleMarkAsPaid(item.vendaId, item.clienteNome, Number(item.valor))}
                                disabled={payingVendaId === item.vendaId}
                                title="Confirmar pagamento recebido do cliente"
                              >
                                <Check size={12} />
                                {payingVendaId === item.vendaId ? 'Salvando...' : 'Marcar Pago'}
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle size={13} /> Quitado
                              </span>
                            )}

                            <a
                              href={`https://wa.me/${item.whatsapp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="table-action-btn"
                              title="Continuar conversa no WhatsApp"
                            >
                              <MessageSquare size={13} color="var(--primary)" />
                            </a>

                            <button
                              type="button"
                              className="table-action-btn"
                              onClick={() => toggleExpand(msgKey)}
                              title={isExpanded ? 'Ocultar mensagem enviada' : 'Ver mensagem enviada'}
                            >
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Conteúdo da Aba 3: Em Atraso */}
        {activeTab === 'atrasados' && (
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                  <th style={{ minWidth: '180px' }}>Cliente</th>
                  <th style={{ minWidth: '180px' }}>WhatsApp</th>
                  <th style={{ minWidth: '220px' }}>Venda / Aparelho</th>
                  <th style={{ minWidth: '140px', textAlign: 'center' }}>Atraso</th>
                  <th style={{ minWidth: '120px', textAlign: 'right' }}>Valor em Atraso</th>
                  <th style={{ minWidth: '120px', textAlign: 'center' }}>Vencimento</th>
                  <th style={{ minWidth: '160px', textAlign: 'center' }}>Último Envio</th>
                  <th style={{ minWidth: '210px', textAlign: 'center' }}>Ações Rápidas</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
                      Carregando clientes em atraso...
                    </td>
                  </tr>
                ) : data.emAtraso.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                      <CheckCircle2 size={36} color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                        Nenhum cliente em atraso no momento!
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Excelente! Todos os pagamentos e faturas estão em dia.
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.emAtraso.map((item: OverdueReminderItem, idx: number) => {
                    const encodedMsg = encodeURIComponent(item.mensagemCobranca);
                    const mockVenda: Venda = {
                      id: item.vendaId,
                      cliente_id: item.clienteId,
                      descricao: item.descricao || 'Venda',
                      valor: item.valor,
                      dia_vencimento: 1,
                      status_mes_atual: 'vencido',
                      data_vencimento_atual: item.dataVencimentoISO,
                      ativo: true,
                    };

                    return (
                      <tr key={item.vendaId} className="row-vencido">
                        <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.76rem', fontFamily: 'monospace' }}>
                          {idx + 1}
                        </td>

                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#fff' }}>
                          {item.clienteNome}
                        </td>

                        <td>
                          {item.whatsapp ? (
                            <a
                              href={`https://wa.me/${item.whatsapp}?text=${encodedMsg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="whatsapp-pill-btn"
                              title="Abrir WhatsApp com cobrança de atraso"
                            >
                              <Phone size={11} />
                              <span>{formatFullWhatsApp(item.whatsapp)}</span>
                              <ExternalLink size={10} style={{ opacity: 0.7 }} />
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>-</span>
                          )}
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{item.descricao}</div>
                          {item.totalParcelas && item.totalParcelas > 1 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                              Parcela {item.parcelaAtual || 1} de {item.totalParcelas}
                            </span>
                          )}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {getDelayBadge(item.diasAtraso)}
                        </td>

                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#f87171',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          R$ {Number(item.valor).toFixed(2).replace('.', ',')}
                        </td>

                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: '#f87171', fontWeight: 600 }}>
                            <Calendar size={13} color="#ef4444" />
                            {item.dataVencimento}
                          </span>
                        </td>

                        <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          {item.ultimoEnvio ? (
                            <div>
                              <span style={{ color: '#38bdf8', fontWeight: 500 }}>
                                {item.ultimoEnvio.tipo === 'vencido'
                                  ? 'Aviso Vencido'
                                  : item.ultimoEnvio.tipo === 'lembrete_1d'
                                  ? 'Lembrete (1d)'
                                  : 'Lembrete (3d)'}
                              </span>
                              {item.ultimoEnvio.dataEnvio && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {new Date(item.ultimoEnvio.dataEnvio).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span>Ainda não enviado</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <a
                              href={`https://wa.me/${item.whatsapp}?text=${encodedMsg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary btn-sm"
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.75rem',
                                textDecoration: 'none',
                                background: '#dc2626',
                                borderColor: '#ef4444',
                              }}
                              title="Cobrar agora no WhatsApp"
                            >
                              <MessageSquare size={13} /> Cobrar
                            </a>

                            <button
                              className="table-action-btn"
                              onClick={() => onOpenHistoricoModal(mockVenda)}
                              title="Ver histórico de mensagens enviadas"
                            >
                              <History size={14} />
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleMarkAsPaid(item.vendaId, item.clienteNome, Number(item.valor))}
                              disabled={payingVendaId === item.vendaId}
                              title="Marcar pagamento recebido"
                            >
                              <Check size={13} color="var(--primary)" />
                              {payingVendaId === item.vendaId ? 'Salvando...' : 'Pago'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
