import React, { useState, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  Send,
  CheckCircle2,
  Calendar,
  RefreshCw,
  MessageSquare,
  Check,
  History,
  Phone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CentralNotificacoesData,
  ReminderPreviewItem,
  OverdueReminderItem,
  EnviadoItem,
  Venda,
  WhatsAppStatus,
  ConfiguracaoData,
} from '../types/index.js';
import { api } from '../services/api.js';
import { formatFullWhatsApp } from '../utils/phone.js';
import { extractErrorMessage } from '../utils/error.js';
import { summarizeSede } from '../utils/sede.js';
import { formatBRL } from '../utils/format.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatTile, StatTone } from '../components/ui/StatTile.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { MensagensEditor } from '../components/MensagensEditor.js';

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
  const [activeTab, setActiveTab] = useState<'hoje' | 'enviados' | 'atrasados' | 'mensagens'>('hoje');
  const [config, setConfig] = useState<ConfiguracaoData | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
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

  const fetchConfig = async () => {
    try {
      const res = await api.get('/configuracoes');
      setConfig(res.data);
    } catch {
      // Sem as configurações a tela segue funcionando com o padrão
    }
  };

  useEffect(() => {
    fetchCentralData(true);
    fetchConfig();
  }, []);

  const handleToggleAuto = async () => {
    if (!config || savingAuto) return;
    const ligar = !config.envio_automatico;

    if (
      !ligar &&
      !window.confirm(
        'Desligar o envio automático? Nenhum aviso sairá sozinho até você ligar de novo. O botão de disparo manual continua funcionando.'
      )
    ) {
      return;
    }

    setSavingAuto(true);
    setConfigError(null);
    try {
      const res = await api.put('/configuracoes', { envio_automatico: ligar });
      setConfig(res.data);
    } catch (err: unknown) {
      setConfigError(extractErrorMessage(err, 'Não foi possível alterar o envio automático.'));
    } finally {
      setSavingAuto(false);
    }
  };

  // Uma mensagem alterada muda o texto dos avisos que ainda vão sair hoje
  const handleMensagensSaved = (nova: ConfiguracaoData) => {
    setConfig(nova);
    fetchCentralData();
  };

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
      `Confirmar recebimento do pagamento de "${nome}" no valor de ${formatBRL(valor)}?`
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

  // Tipo do aviso: ícone + rótulo
  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'lembrete_3d':
        return (
          <span className="badge badge-avisado">
            <Clock size={12} /> Lembrete · 3 dias
          </span>
        );
      case 'lembrete_2d':
        return (
          <span className="badge badge-avisado">
            <Clock size={12} /> Lembrete · 2 dias
          </span>
        );
      case 'lembrete_1d':
        return (
          <span className="badge badge-avisado">
            <Clock size={12} /> Lembrete · véspera
          </span>
        );
      case 'vencido':
        return (
          <span className="badge badge-vencido">
            <AlertTriangle size={12} /> Aviso de vencimento
          </span>
        );
      default:
        return <span className="badge">Lembrete</span>;
    }
  };

  const getDelayBadge = (dias: number) => {
    if (dias === 0) {
      return (
        <span className="badge badge-avisado">
          <span className="status-dot dot-warning" aria-hidden="true" />
          Vence hoje
        </span>
      );
    }
    return (
      <span className={`badge ${dias <= 3 ? 'badge-avisado' : 'badge-vencido'}`}>
        <span className={`status-dot ${dias <= 3 ? 'dot-warning' : 'dot-danger'}`} aria-hidden="true" />
        {dias} {dias === 1 ? 'dia' : 'dias'} de atraso
      </span>
    );
  };

  const getUltimoEnvioLabel = (tipo: string) => {
    switch (tipo) {
      case 'vencido':
        return 'Aviso de vencimento';
      case 'lembrete_1d':
        return 'Lembrete da véspera';
      case 'lembrete_2d':
        return 'Lembrete de 2 dias';
      default:
        return 'Lembrete de 3 dias';
    }
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

  // Nome do cliente com o telefone logo abaixo (abre a conversa no WhatsApp)
  const renderCliente = (nome: string, whatsapp: string, href: string, title: string) => (
    <div className="cell-stack">
      <span className="cell-title">{nome}</span>
      {whatsapp && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="cell-link" title={title}>
          <Phone size={11} />
          {formatFullWhatsApp(whatsapp)}
        </a>
      )}
    </div>
  );

  const totalEnviados = data.enviadosRecentes?.length || 0;
  const totalPagosAposEnvio = data.resumo.totalPagosAposEnvio || 0;

  const sedeTone: Record<string, StatTone> = { ok: 'success', warn: 'warning', off: 'danger', unknown: 'neutral' };
  const conexao = isRemotePanel
    ? { label: 'Máquina-sede', value: sede.short, tone: sedeTone[sede.tone], hint: 'Os envios saem pelo computador da loja' }
    : whatsAppStatus === 'open'
      ? { label: 'WhatsApp', value: 'Conectado', tone: 'success' as StatTone, hint: 'Pronto para enviar' }
      : whatsAppStatus === 'connecting'
        ? { label: 'WhatsApp', value: 'Conectando...', tone: 'warning' as StatTone, hint: 'Aguarde a conexão' }
        : { label: 'WhatsApp', value: 'Desconectado', tone: 'danger' as StatTone, hint: 'Toque para conectar' };

  return (
    <div>
      <PageHeader
        title="Notificações"
        subtitle="Quem será avisado hoje, o que já foi enviado e quem está em atraso."
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchCentralData()} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>

            {!isRemotePanel && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleDispatchToday}
                disabled={dispatching || data.agendadosHoje.length === 0}
                title={data.agendadosHoje.length === 0 ? 'Não há avisos para enviar hoje' : undefined}
              >
                <Send size={15} />
                {dispatching ? 'Enfileirando...' : `Disparar avisos de hoje (${data.agendadosHoje.length})`}
              </button>
            )}
          </>
        }
      />

      {feedbackMsg && (
        <div className="alert alert-success" role="status">
          <CheckCircle2 size={18} />
          {feedbackMsg}
        </div>
      )}

      {/* Indicadores (clicáveis: abrem a lista correspondente) */}
      <div className="grid-cards">
        <StatTile
          label="Para enviar hoje"
          value={data.resumo.totalHoje}
          hint={`${formatBRL(data.resumo.valorHoje)} em cobranças`}
          tone={data.resumo.totalHoje > 0 ? 'warning' : 'neutral'}
          onClick={() => setActiveTab('hoje')}
        />
        <StatTile
          label="Enviadas"
          value={totalEnviados}
          hint={`${totalPagosAposEnvio} ${totalPagosAposEnvio === 1 ? 'já pagou' : 'já pagaram'}`}
          onClick={() => setActiveTab('enviados')}
        />
        <StatTile
          label="Em atraso"
          value={data.resumo.totalAtrasados}
          hint={`${formatBRL(data.resumo.valorAtrasado)} em aberto`}
          tone={data.resumo.totalAtrasados > 0 ? 'danger' : 'neutral'}
          onClick={() => setActiveTab('atrasados')}
        />
        <StatTile
          label={conexao.label}
          value={conexao.value}
          hint={conexao.hint}
          tone={conexao.tone}
          onClick={isRemotePanel ? undefined : onOpenWhatsAppModal}
          title={isRemotePanel ? sede.detail : undefined}
        />
      </div>

      {/* Liga/desliga do envio diário feito pela máquina-sede */}
      {config && (
        <div className={`setting-row ${config.envio_automatico ? '' : 'is-off'}`}>
          <div className="setting-row-text">
            <div className="setting-row-title">
              <span
                className={`status-dot ${config.envio_automatico ? 'dot-success' : 'dot-warning'}`}
                aria-hidden="true"
              />
              Envio automático {config.envio_automatico ? 'ligado' : 'desligado'}
            </div>
            <div className="panel-caption">
              {config.envio_automatico
                ? 'O computador da loja envia os avisos sozinho, todos os dias.'
                : 'Nenhum aviso sai sozinho. Para enviar, use o botão "Disparar avisos de hoje" no computador da loja.'}
            </div>
            {configError && (
              <div className="form-hint is-danger" role="alert">
                {configError}
              </div>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={config.envio_automatico}
            aria-label="Envio automático"
            className={`switch ${config.envio_automatico ? 'is-on' : ''}`}
            onClick={handleToggleAuto}
            disabled={savingAuto}
          >
            <span className="switch-thumb" />
          </button>
        </div>
      )}

      <div className="excel-wrapper">
        <div className="excel-toolbar">
          <div className="excel-filters">
            <button
              type="button"
              className={`excel-filter-btn ${activeTab === 'hoje' ? 'active' : ''}`}
              onClick={() => setActiveTab('hoje')}
            >
              <Calendar size={14} />
              <span>Para enviar hoje</span>
              <span className="excel-filter-count">{data.agendadosHoje.length}</span>
            </button>

            <button
              type="button"
              className={`excel-filter-btn ${activeTab === 'enviados' ? 'active' : ''}`}
              onClick={() => setActiveTab('enviados')}
            >
              <Send size={14} />
              <span>Enviadas</span>
              <span className="excel-filter-count">{totalEnviados}</span>
            </button>

            <button
              type="button"
              className={`excel-filter-btn ${activeTab === 'atrasados' ? 'active' : ''}`}
              onClick={() => setActiveTab('atrasados')}
            >
              <AlertTriangle size={14} />
              <span>Em atraso</span>
              <span className={`excel-filter-count ${data.emAtraso.length > 0 ? 'has-alert' : ''}`}>
                {data.emAtraso.length}
              </span>
            </button>

            {config && (
              <button
                type="button"
                className={`excel-filter-btn ${activeTab === 'mensagens' ? 'active' : ''}`}
                onClick={() => setActiveTab('mensagens')}
              >
                <MessageSquare size={14} />
                <span>Mensagens</span>
              </button>
            )}
          </div>

          <div className="toolbar-meta">
            {activeTab === 'hoje'
              ? 'Avisos que a régua automática programou para hoje.'
              : activeTab === 'enviados'
                ? 'Mensagens já enviadas: acompanhe quem pagou e dê baixa.'
                : activeTab === 'atrasados'
                  ? 'Parcelas vencidas que ainda não foram pagas.'
                  : 'Edite o texto de cada aviso. Toque em uma variável para inseri-la.'}
          </div>
        </div>

        {/* Aba 4: texto das mensagens */}
        {activeTab === 'mensagens' && config && <MensagensEditor config={config} onSaved={handleMensagensSaved} />}

        {/* Aba 1: para enviar hoje */}
        {activeTab === 'hoje' && (
          <div className="excel-table-container">
            <table className="excel-table stack-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Venda</th>
                  <th>Aviso</th>
                  <th className="num">Valor</th>
                  <th>Vencimento</th>
                  <th>Mensagem</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr className="is-plain">
                    <td colSpan={7} className="stack-full">
                      <EmptyState title="Carregando avisos de hoje..." />
                    </td>
                  </tr>
                ) : data.agendadosHoje.length === 0 ? (
                  <tr className="is-plain">
                    <td colSpan={7} className="stack-full">
                      <EmptyState
                        icon={<CheckCircle2 size={32} />}
                        title="Nenhum aviso para enviar hoje"
                        text="Os clientes do período já foram avisados, ou os próximos vencimentos ainda estão fora da janela de 3 dias."
                      />
                    </td>
                  </tr>
                ) : (
                  data.agendadosHoje.map((item: ReminderPreviewItem) => {
                    const msgKey = `hoje-${item.vendaId}`;
                    const isExpanded = expandedMessageId === msgKey;
                    const waLink = `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(item.mensagem)}`;

                    return (
                      <tr key={item.vendaId}>
                        <td data-label="Cliente">
                          {renderCliente(item.clienteNome, item.whatsapp, waLink, 'Abrir o WhatsApp com a mensagem pronta')}
                        </td>

                        <td data-label="Venda">{item.descricao || 'Cobrança'}</td>

                        <td data-label="Aviso">{getTipoBadge(item.tipo)}</td>

                        <td data-label="Valor" className="num cell-title">
                          {formatBRL(item.valor)}
                        </td>

                        <td data-label="Vencimento">
                          <span className="date-cell">
                            <Calendar size={13} />
                            {item.dataVencimento}
                          </span>
                        </td>

                        <td className="stack-full">
                          <div className="message-preview">
                            <div className={`message-preview-text ${isExpanded ? 'is-expanded' : ''}`}>
                              {item.mensagem}
                            </div>
                            <button type="button" className="link-btn" onClick={() => toggleExpand(msgKey)}>
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

                        <td className="stack-full" style={{ textAlign: 'right' }}>
                          <div className="cell-actions">
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              title="Abrir o WhatsApp com a mensagem pronta"
                            >
                              <MessageSquare size={14} /> Enviar
                            </a>

                            <button
                              className="btn btn-pay btn-sm"
                              onClick={() => handleMarkAsPaid(item.vendaId, item.clienteNome, Number(item.valor))}
                              disabled={payingVendaId === item.vendaId}
                              title="O cliente já pagou (ex.: no balcão)"
                            >
                              <Check size={14} />
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

        {/* Aba 2: enviadas */}
        {activeTab === 'enviados' && (
          <div className="excel-table-container">
            <table className="excel-table stack-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Venda</th>
                  <th className="num">Valor</th>
                  <th>Enviado em</th>
                  <th>Aviso</th>
                  <th>Pagamento</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr className="is-plain">
                    <td colSpan={7} className="stack-full">
                      <EmptyState title="Carregando mensagens enviadas..." />
                    </td>
                  </tr>
                ) : !data.enviadosRecentes || data.enviadosRecentes.length === 0 ? (
                  <tr className="is-plain">
                    <td colSpan={7} className="stack-full">
                      <EmptyState
                        icon={<Send size={32} />}
                        title="Nenhuma mensagem enviada ainda"
                        text="Depois do primeiro disparo, os clientes avisados aparecem aqui para você acompanhar os pagamentos."
                      />
                    </td>
                  </tr>
                ) : (
                  data.enviadosRecentes.map((item: EnviadoItem) => {
                    const isPago = item.statusMesAtual === 'pago';
                    const msgKey = `env-${item.id}`;
                    const isExpanded = expandedMessageId === msgKey;
                    const waLink = `https://wa.me/${item.whatsapp}`;

                    return (
                      <React.Fragment key={item.id}>
                        <tr>
                          <td data-label="Cliente">
                            {renderCliente(item.clienteNome, item.whatsapp, waLink, 'Abrir a conversa no WhatsApp')}
                          </td>

                          <td data-label="Venda">{item.descricao || 'Cobrança'}</td>

                          <td data-label="Valor" className="num cell-title">
                            {formatBRL(item.valor)}
                          </td>

                          <td data-label="Enviado em" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(item.dataEnvio)}
                          </td>

                          <td data-label="Aviso">{getTipoBadge(item.tipo)}</td>

                          <td data-label="Pagamento">
                            {isPago ? (
                              <span className="badge badge-pago">
                                <span className="status-dot dot-success" aria-hidden="true" />
                                Pago
                              </span>
                            ) : (
                              <span className="badge badge-pendente">
                                <span className="status-dot dot-neutral" aria-hidden="true" />
                                Aguardando
                              </span>
                            )}
                          </td>

                          <td className="stack-full" style={{ textAlign: 'right' }}>
                            <div className="cell-actions">
                              {!isPago && (
                                <button
                                  className="btn btn-pay btn-sm"
                                  onClick={() => handleMarkAsPaid(item.vendaId, item.clienteNome, Number(item.valor))}
                                  disabled={payingVendaId === item.vendaId}
                                  title="Confirmar que o cliente pagou"
                                >
                                  <Check size={14} />
                                  {payingVendaId === item.vendaId ? 'Salvando...' : 'Marcar pago'}
                                </button>
                              )}

                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="table-action-btn"
                                title="Abrir a conversa no WhatsApp"
                                aria-label="Abrir a conversa no WhatsApp"
                              >
                                <MessageSquare size={15} />
                              </a>

                              <button
                                type="button"
                                className="table-action-btn"
                                onClick={() => toggleExpand(msgKey)}
                                title={isExpanded ? 'Ocultar a mensagem enviada' : 'Ver a mensagem enviada'}
                                aria-label={isExpanded ? 'Ocultar a mensagem enviada' : 'Ver a mensagem enviada'}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="stack-full">
                              <div className="message-preview" style={{ maxWidth: 'none' }}>
                                <div className="message-preview-text is-expanded">
                                  {item.mensagem || 'O texto desta mensagem não foi registrado.'}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Aba 3: em atraso */}
        {activeTab === 'atrasados' && (
          <div className="excel-table-container">
            <table className="excel-table stack-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Venda</th>
                  <th>Atraso</th>
                  <th className="num">Valor</th>
                  <th>Vencimento</th>
                  <th>Último aviso</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr className="is-plain">
                    <td colSpan={7} className="stack-full">
                      <EmptyState title="Carregando clientes em atraso..." />
                    </td>
                  </tr>
                ) : data.emAtraso.length === 0 ? (
                  <tr className="is-plain">
                    <td colSpan={7} className="stack-full">
                      <EmptyState
                        icon={<CheckCircle2 size={32} />}
                        title="Nenhum cliente em atraso"
                        text="Todos os pagamentos estão em dia."
                      />
                    </td>
                  </tr>
                ) : (
                  data.emAtraso.map((item: OverdueReminderItem) => {
                    const waLink = `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(item.mensagemCobranca)}`;
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
                        <td data-label="Cliente">
                          {renderCliente(item.clienteNome, item.whatsapp, waLink, 'Abrir o WhatsApp com a cobrança pronta')}
                        </td>

                        <td data-label="Venda">
                          <div className="cell-stack">
                            <span>{item.descricao}</span>
                            {item.totalParcelas && item.totalParcelas > 1 && (
                              <span className="cell-sub">
                                Parcela {item.parcelaAtual || 1} de {item.totalParcelas}
                              </span>
                            )}
                          </div>
                        </td>

                        <td data-label="Atraso">{getDelayBadge(item.diasAtraso)}</td>

                        <td data-label="Valor" className="num cell-title">
                          {formatBRL(item.valor)}
                        </td>

                        <td data-label="Vencimento">
                          <span className="date-cell is-overdue">
                            <Calendar size={13} />
                            {item.dataVencimento}
                          </span>
                        </td>

                        <td data-label="Último aviso">
                          {item.ultimoEnvio ? (
                            <div className="cell-stack">
                              <span>{getUltimoEnvioLabel(item.ultimoEnvio.tipo)}</span>
                              {item.ultimoEnvio.dataEnvio && (
                                <span className="cell-sub">
                                  {new Date(item.ultimoEnvio.dataEnvio).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>Ainda não enviado</span>
                          )}
                        </td>

                        <td className="stack-full" style={{ textAlign: 'right' }}>
                          <div className="cell-actions">
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              title="Abrir o WhatsApp com a cobrança pronta"
                            >
                              <MessageSquare size={14} /> Cobrar
                            </a>

                            <button
                              className="btn btn-pay btn-sm"
                              onClick={() => handleMarkAsPaid(item.vendaId, item.clienteNome, Number(item.valor))}
                              disabled={payingVendaId === item.vendaId}
                              title="Confirmar que o cliente pagou"
                            >
                              <Check size={14} />
                              {payingVendaId === item.vendaId ? 'Salvando...' : 'Pago'}
                            </button>

                            <button
                              type="button"
                              className="table-action-btn"
                              onClick={() => onOpenHistoricoModal(mockVenda)}
                              title="Histórico de mensagens"
                              aria-label="Histórico de mensagens"
                            >
                              <History size={15} />
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
