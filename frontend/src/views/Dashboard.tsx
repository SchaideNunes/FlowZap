import React, { useState, useEffect } from 'react';
import {
  Send,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Smartphone,
  PlusCircle,
  RefreshCw,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { DashboardMetrics, WhatsAppStatus, ContaPagar } from '../types/index.js';
import { api } from '../services/api.js';

interface DashboardProps {
  whatsAppStatus: WhatsAppStatus['state'];
  onOpenWhatsAppModal: () => void;
  onOpenDisparoModal: () => void;
  onOpenNovoClienteModal: () => void;
  onOpenNovaVendaModal: () => void;
  onNavigateToClientes: () => void;
  onNavigateToContasPagar?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  whatsAppStatus,
  onOpenWhatsAppModal,
  onOpenDisparoModal,
  onOpenNovoClienteModal,
  onOpenNovaVendaModal,
  onNavigateToClientes,
  onNavigateToContasPagar,
}) => {
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

  const formatBRL = (val: number) => {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Cálculos de Quem Devemos
  const totalQueDevemosPendente = contasPagar
    .filter((c) => !c.pago)
    .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

  const totalQueDevemosPago = contasPagar
    .filter((c) => c.pago)
    .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

  const countCredoresPendentes = contasPagar.filter((c) => !c.pago).length;

  // Balanço Líquido Projetado: Total Previsto a Receber - Total a Pagar para Credores
  const saldoLiquidoPrevisto = metrics.valorTotalMensal - totalQueDevemosPendente;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div>
      {/* Header com Saudações e Ações */}
      <div className="view-header" style={{ marginBottom: '1.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Visão Geral de Cobranças & Finanças</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Acompanhe o faturamento recorrente, contas a pagar a fornecedores e status dos disparos de WhatsApp.
          </p>
        </div>

        <div className="view-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onOpenNovoClienteModal}>
            <PlusCircle size={14} />
            Novo Cliente
          </button>
          <button className="btn btn-primary btn-sm" onClick={onOpenNovaVendaModal}>
            <DollarSign size={14} />
            Nova Cobrança
          </button>
        </div>
      </div>

      {/* Banner Principal: Disparo de Cobranças de Hoje */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(17, 24, 39, 0.95) 100%)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          padding: '1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem' }}>
            <span className="badge badge-pago">Motor de Automação Ativo</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Cron automático roda diariamente às 09:00 na sede
            </span>
          </div>
          <h3 style={{ fontSize: '1.35rem', marginBottom: '0.4rem', color: '#fff' }}>
            Disparo Manual de Cobranças
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.4' }}>
            O computador esteve desligado no horário agendado ou deseja disparar os lembretes do dia agora?
            Visualize a lista de clientes antes de autorizar o envio seguro.
          </p>
        </div>

        <div className="dashboard-banner-action">
          <button
            className="btn btn-primary btn-lg"
            onClick={onOpenDisparoModal}
            style={{
              boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
              fontWeight: 600,
            }}
          >
            <Send size={18} />
            Disparar cobranças de hoje
          </button>
        </div>
      </div>

      {/* Grid de Cards de Estatísticas das Cobranças */}
      <div className="grid-cards" style={{ marginBottom: '1.75rem' }}>
        {/* Total Pendentes */}
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-label">Pendentes no Mês</span>
            <span className="stat-value">{metrics.totalPendentes}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Aguardando ciclo de aviso
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'var(--accent-blue-light)', color: 'var(--accent-blue)' }}>
            <Clock size={22} />
          </div>
        </div>

        {/* Avisados (3d ou 1d) */}
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-label">Lembretes Enviados</span>
            <span className="stat-value">{metrics.totalAvisados}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Avisados 3d ou 1d antes
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
            <Send size={22} />
          </div>
        </div>

        {/* Vencidos */}
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-label">Vencidos em Aberto</span>
            <span className="stat-value" style={{ color: metrics.totalVencidos > 0 ? '#f87171' : '#fff' }}>
              {metrics.totalVencidos}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Requer atenção ou contato
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
            <AlertCircle size={22} />
          </div>
        </div>

        {/* Pagos no Mês */}
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-label">Pagamentos Confirmados</span>
            <span className="stat-value" style={{ color: '#34d399' }}>
              {metrics.totalPagos}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Ciclos renovados (+1 mês)
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <CheckCircle size={22} />
          </div>
        </div>
      </div>

      {/* SEÇÃO FINANCEIRA: FATURAMENTO + QUEM DEVEMOS + BALANÇO LÍQUIDO */}
      <div className="dashboard-finance-grid">
        {/* CARD 1: Faturamento Mensal a Receber */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={20} color="var(--primary)" />
                <h4 style={{ fontSize: '1.05rem' }}>Faturamento Recorrente</h4>
              </div>
              <span className="badge badge-pago">A Receber</span>
            </div>

            <div className="stat-split-row">
              <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Previsto</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                  {formatBRL(metrics.valorTotalMensal)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Já Recebido</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>
                  {formatBRL(metrics.valorTotalRecebido)}
                </div>
              </div>
            </div>

            {/* Barra de Progresso */}
            {metrics.valorTotalMensal > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>Progresso recebimento</span>
                  <span>
                    {Math.round((metrics.valorTotalRecebido / metrics.valorTotalMensal) * 100)}%
                  </span>
                </div>
                <div style={{ height: '7px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round((metrics.valorTotalRecebido / metrics.valorTotalMensal) * 100))}%`,
                      background: 'var(--primary)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onNavigateToClientes}
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
          >
            <Users size={14} /> Ver Clientes Devedores
          </button>
        </div>

        {/* CARD 2: Quem Devemos (Contas a Pagar / Fornecedores) */}
        <div
          className="card"
          style={{
            borderLeft: '3px solid #f43f5e',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} color="#f43f5e" />
                <h4 style={{ fontSize: '1.05rem' }}>Quem Devemos (Contas a Pagar)</h4>
              </div>
              <span className="badge badge-vencido">A Pagar</span>
            </div>

            <div className="stat-split-row">
              <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total a Pagar</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fb7185' }}>
                  {formatBRL(totalQueDevemosPendente)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Já Quitado</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>
                  {formatBRL(totalQueDevemosPago)}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {countCredoresPendentes === 0 ? (
                <span style={{ color: '#34d399' }}>✓ Todos os credores e contas estão em dia!</span>
              ) : (
                <span>
                  <strong>{countCredoresPendentes}</strong> credores/fornecedores aguardando quitação.
                </span>
              )}
            </div>
          </div>

          {onNavigateToContasPagar && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onNavigateToContasPagar}
              style={{
                width: '100%',
                justifyContent: 'center',
                marginTop: '0.5rem',
                borderColor: 'rgba(244, 63, 94, 0.35)',
                color: '#fb7185',
              }}
            >
              <Building2 size={14} /> Acessar Tela Quem Devemos <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* CARD 3: Balanço Líquido Geral do Negócio */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={20} color={saldoLiquidoPrevisto >= 0 ? '#10b981' : '#ef4444'} />
                <h4 style={{ fontSize: '1.05rem' }}>Balanço Líquido Geral</h4>
              </div>
              <span className={`badge ${saldoLiquidoPrevisto >= 0 ? 'badge-pago' : 'badge-vencido'}`}>
                {saldoLiquidoPrevisto >= 0 ? 'Superávit Previsto' : 'Déficit'}
              </span>
            </div>

            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Saldo Estimado (Receber - Pagar)
              </div>
              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: saldoLiquidoPrevisto >= 0 ? '#34d399' : '#f87171',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {saldoLiquidoPrevisto >= 0 ? '+' : ''}
                {formatBRL(saldoLiquidoPrevisto)}
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: '1.4' }}>
              Cálculo em tempo real do faturamento previsto menos os compromissos com credores cadastrados.
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            <span>A Receber: {formatBRL(metrics.valorTotalMensal)}</span>
            <span style={{ color: '#f87171' }}>A Pagar: {formatBRL(totalQueDevemosPendente)}</span>
          </div>
        </div>
      </div>

      {/* LINHA INFERIOR: RESUMO DE QUEM DEVEMOS & STATUS WHATSAPP */}
      <div className="dashboard-bottom-grid">
        {/* Widget: Próximos Pagamentos de Quem Devemos */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} color="#f87171" />
              <h4 style={{ fontSize: '1rem' }}>Próximos Pagamentos a Fornecedores</h4>
            </div>
            {onNavigateToContasPagar && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onNavigateToContasPagar}
                style={{ fontSize: '0.76rem', padding: '3px 8px' }}
              >
                Ver todos
              </button>
            )}
          </div>

          {contasPagar.filter((c) => !c.pago).length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Nenhuma conta ou credor com pagamento pendente no momento.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {contasPagar
                .filter((c) => !c.pago)
                .slice(0, 4)
                .map((conta) => (
                  <div
                    key={conta.id}
                    style={{
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>
                        {conta.nome_credor}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                        {conta.descricao || 'Sem descrição'}
                        {conta.data_vencimento && ` • Vencimento: ${formatDate(conta.data_vencimento)}`}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.94rem' }}>
                        {formatBRL(conta.valor)}
                      </div>
                      <span className="badge badge-vencido" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                        Pendente
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Card Status do WhatsApp */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Smartphone size={20} color="var(--primary)" />
              <h4 style={{ fontSize: '1.05rem' }}>Status do WhatsApp (Sede)</h4>
            </div>
            {whatsAppStatus === 'open' ? (
              <span className="badge badge-pago">Conectado</span>
            ) : (
              <span className="badge badge-vencido">Desconectado</span>
            )}
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
            {whatsAppStatus === 'open'
              ? 'A sessão está ativa e sincronizada com a máquina-sede. As mensagens de cobrança serão disparadas normalmente.'
              : 'O WhatsApp não está emparelhado. Clique no botão abaixo para escanear o QR Code e autorizar os envios.'}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline-primary btn-sm" onClick={onOpenWhatsAppModal}>
              <Smartphone size={15} />
              {whatsAppStatus === 'open' ? 'Gerenciar Conexão' : 'Escanear QR Code'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onNavigateToClientes}>
              <Users size={15} />
              Ver Clientes Devedores
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
