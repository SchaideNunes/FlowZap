import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, UserPlus, Plus, Smartphone, ArrowRight } from 'lucide-react';
import { DashboardMetrics, WhatsAppStatus, ContaPagar } from '../types/index.js';
import { api } from '../services/api.js';
import { summarizeSede, SEDE_BADGE_CLASS, SEDE_DOT_CLASS } from '../utils/sede.js';
import { formatBRL, formatDateBR } from '../utils/format.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { StatTile } from '../components/ui/StatTile.js';

interface DashboardProps {
  whatsAppInfo: WhatsAppStatus;
  onOpenWhatsAppModal: () => void;
  onOpenDisparoModal: () => void;
  onOpenNovoClienteModal: () => void;
  onOpenNovaVendaModal: () => void;
  onNavigateToClientes: () => void;
  onNavigateToContasPagar?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  whatsAppInfo,
  onOpenWhatsAppModal,
  onOpenDisparoModal,
  onOpenNovoClienteModal,
  onOpenNovaVendaModal,
  onNavigateToClientes,
  onNavigateToContasPagar,
}) => {
  const whatsAppStatus = whatsAppInfo.state;
  const isConnected = whatsAppStatus === 'open';
  // Painel online (ex.: Vercel): não envia mensagens, só mostra o estado da máquina-sede
  const isRemotePanel = whatsAppInfo.available === false;
  const sede = summarizeSede(whatsAppInfo);

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalPendentes: 0,
    totalAvisados: 0,
    totalVencidos: 0,
    totalPagos: 0,
    valorTotalMensal: 0,
    valorTotalRecebido: 0,
  });
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [metricsRes, contasRes] = await Promise.all([
        api.get('/vendas/metrics'),
        api.get('/contas-pagar'),
      ]);
      setMetrics(metricsRes.data);
      setContasPagar(contasRes.data || []);
    } catch {
      // Ignora erro passageiro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Quem devemos
  const contasPendentes = contasPagar.filter((c) => !c.pago);
  const totalQueDevemosPendente = contasPendentes.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
  const totalQueDevemosPago = contasPagar
    .filter((c) => c.pago)
    .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

  // Saldo previsto: total a receber no ciclo menos o que está em aberto com credores
  const saldoLiquidoPrevisto = metrics.valorTotalMensal - totalQueDevemosPendente;
  const saldoPositivo = saldoLiquidoPrevisto >= 0;

  const percentualRecebido =
    metrics.valorTotalMensal > 0
      ? Math.min(100, Math.round((metrics.valorTotalRecebido / metrics.valorTotalMensal) * 100))
      : 0;

  return (
    <div>
      <PageHeader
        title="Visão geral"
        subtitle="Cobranças, contas a pagar e envios de WhatsApp."
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
            <button className="btn btn-primary btn-sm" onClick={onOpenNovaVendaModal}>
              <Plus size={15} />
              Nova cobrança
            </button>
          </>
        }
      />

      {/* Ação do dia: disparo das cobranças */}
      <section className="card action-card">
        <div className="action-card-body">
          <div className="card-eyebrow">
            {isRemotePanel ? (
              <>
                <span className={`status-dot ${SEDE_DOT_CLASS[sede.tone]}`} aria-hidden="true" />
                {sede.label}
              </>
            ) : (
              <>
                <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} aria-hidden="true" />
                {isConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'} · envio automático todo dia às 09:00
              </>
            )}
          </div>
          <h2 className="action-card-title">
            {isRemotePanel ? 'Os envios saem pelo computador da loja' : 'Cobranças de hoje'}
          </h2>
          <p className="panel-text">
            {isRemotePanel
              ? `${sede.detail} Para disparar manualmente, abra o sistema na máquina-sede.`
              : isConnected
                ? 'Veja quem será avisado antes de confirmar o envio. Útil quando o computador esteve desligado às 09:00 ou para adiantar os lembretes do dia.'
                : 'Conecte o WhatsApp da loja para que os lembretes voltem a ser enviados.'}
          </p>
        </div>

        {!isRemotePanel && (
          <div className="dashboard-banner-action">
            {isConnected ? (
              <button className="btn btn-primary btn-lg" onClick={onOpenDisparoModal}>
                <Send size={18} />
                Disparar cobranças de hoje
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={onOpenWhatsAppModal}>
                <Smartphone size={18} />
                Conectar WhatsApp
              </button>
            )}
          </div>
        )}
      </section>

      {/* Situação das cobranças no ciclo (clique para abrir a lista) */}
      <div className="grid-cards">
        <StatTile
          label="Pendentes"
          value={metrics.totalPendentes}
          hint="Fora do período de aviso"
          onClick={onNavigateToClientes}
        />
        <StatTile
          label="Avisados"
          value={metrics.totalAvisados}
          hint="Já receberam lembrete"
          tone={metrics.totalAvisados > 0 ? 'warning' : 'neutral'}
          onClick={onNavigateToClientes}
        />
        <StatTile
          label="Vencidos"
          value={metrics.totalVencidos}
          hint={metrics.totalVencidos > 0 ? 'Precisam de cobrança' : 'Nenhuma parcela atrasada'}
          tone={metrics.totalVencidos > 0 ? 'danger' : 'neutral'}
          onClick={onNavigateToClientes}
        />
        <StatTile
          label="Pagos"
          value={metrics.totalPagos}
          hint="Pagamentos confirmados"
          tone={metrics.totalPagos > 0 ? 'success' : 'neutral'}
          onClick={onNavigateToClientes}
        />
      </div>

      {/* Financeiro: a receber, a pagar e saldo */}
      <div className="dashboard-finance-grid">
        <section className="card panel">
          <div className="panel-head">
            <h3 className="panel-title">A receber</h3>
            <span className="panel-caption">Ciclo atual</span>
          </div>

          <div className="figure-row">
            <div className="figure">
              <span className="figure-label">Previsto</span>
              <span className="figure-value">{formatBRL(metrics.valorTotalMensal)}</span>
            </div>
            <div className="figure">
              <span className="figure-label">
                <span className="status-dot dot-success" aria-hidden="true" />
                Recebido
              </span>
              <span className="figure-value">{formatBRL(metrics.valorTotalRecebido)}</span>
            </div>
          </div>

          <div>
            <div className="progress-meta">
              <span>Recebido até agora</span>
              <span>{percentualRecebido}%</span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-valuenow={percentualRecebido}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Percentual recebido no ciclo"
            >
              <span style={{ width: `${percentualRecebido}%` }} />
            </div>
          </div>

          <div className="panel-foot">
            <button className="btn btn-secondary btn-sm btn-block" onClick={onNavigateToClientes}>
              Ver clientes e vendas <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="card panel">
          <div className="panel-head">
            <h3 className="panel-title">A pagar</h3>
            <span className="panel-caption">Fornecedores e credores</span>
          </div>

          <div className="figure-row">
            <div className="figure">
              <span className="figure-label">
                {totalQueDevemosPendente > 0 && <span className="status-dot dot-danger" aria-hidden="true" />}
                Em aberto
              </span>
              <span className="figure-value">{formatBRL(totalQueDevemosPendente)}</span>
            </div>
            <div className="figure">
              <span className="figure-label">
                <span className="status-dot dot-success" aria-hidden="true" />
                Quitado
              </span>
              <span className="figure-value">{formatBRL(totalQueDevemosPago)}</span>
            </div>
          </div>

          <p className="panel-text">
            {contasPendentes.length === 0
              ? 'Todas as contas estão em dia.'
              : `${contasPendentes.length} ${contasPendentes.length === 1 ? 'conta aguardando' : 'contas aguardando'} pagamento.`}
          </p>

          {onNavigateToContasPagar && (
            <div className="panel-foot">
              <button className="btn btn-secondary btn-sm btn-block" onClick={onNavigateToContasPagar}>
                Ver contas a pagar <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>

        <section className="card panel">
          <div className="panel-head">
            <h3 className="panel-title">Saldo previsto</h3>
            <span className="panel-caption">A receber − a pagar</span>
          </div>

          <div>
            <div className="hero-figure">
              {saldoPositivo ? '' : '−'}
              {formatBRL(Math.abs(saldoLiquidoPrevisto))}
            </div>
            <div className="figure-label" style={{ marginTop: '0.5rem' }}>
              <span className={`status-dot ${saldoPositivo ? 'dot-success' : 'dot-danger'}`} aria-hidden="true" />
              {saldoPositivo ? 'Sobra prevista no ciclo' : 'Falta prevista no ciclo'}
            </div>
          </div>

          <div className="panel-foot" style={{ justifyContent: 'space-between' }}>
            <span className="panel-caption">A receber {formatBRL(metrics.valorTotalMensal)}</span>
            <span className="panel-caption">A pagar {formatBRL(totalQueDevemosPendente)}</span>
          </div>
        </section>
      </div>

      <div className="dashboard-bottom-grid">
        <section className="card panel">
          <div className="panel-head">
            <h3 className="panel-title">Próximos pagamentos</h3>
            {onNavigateToContasPagar && (
              <button className="btn btn-ghost btn-sm" onClick={onNavigateToContasPagar}>
                Ver todos
              </button>
            )}
          </div>

          {contasPendentes.length === 0 ? (
            <p className="panel-text">Nenhuma conta com pagamento pendente.</p>
          ) : (
            <div>
              {contasPendentes.slice(0, 4).map((conta) => (
                <div key={conta.id} className="list-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="list-row-title">{conta.nome_credor}</div>
                    <div className="list-row-sub">
                      {conta.descricao || 'Sem descrição'}
                      {conta.data_vencimento && ` · vence em ${formatDateBR(conta.data_vencimento)}`}
                    </div>
                  </div>
                  <div className="list-row-title num">{formatBRL(conta.valor)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card panel">
          <div className="panel-head">
            <h3 className="panel-title">{isRemotePanel ? 'Máquina-sede' : 'WhatsApp'}</h3>
            {isRemotePanel ? (
              <span className={`badge ${SEDE_BADGE_CLASS[sede.tone]}`}>
                <span className={`status-dot ${SEDE_DOT_CLASS[sede.tone]}`} aria-hidden="true" />
                {sede.short}
              </span>
            ) : (
              <span className={`badge ${isConnected ? 'badge-pago' : 'badge-vencido'}`}>
                <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} aria-hidden="true" />
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            )}
          </div>

          <p className="panel-text">
            {isRemotePanel
              ? sede.detail
              : isConnected
                ? 'A sessão está ativa neste computador. Os lembretes saem normalmente.'
                : 'Nenhum número conectado. Leia o QR Code com o celular da loja para liberar os envios.'}
          </p>

          {!isRemotePanel && (
            <div className="panel-foot">
              <button className="btn btn-secondary btn-sm" onClick={onOpenWhatsAppModal}>
                <Smartphone size={15} />
                {isConnected ? 'Gerenciar conexão' : 'Ler QR Code'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
