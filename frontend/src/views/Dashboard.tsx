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
} from 'lucide-react';
import { DashboardMetrics, WhatsAppStatus } from '../types/index.js';
import { api } from '../services/api.js';

interface DashboardProps {
  whatsAppStatus: WhatsAppStatus['state'];
  onOpenWhatsAppModal: () => void;
  onOpenDisparoModal: () => void;
  onOpenNovoClienteModal: () => void;
  onOpenNovaVendaModal: () => void;
  onNavigateToClientes: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  whatsAppStatus,
  onOpenWhatsAppModal,
  onOpenDisparoModal,
  onOpenNovoClienteModal,
  onOpenNovaVendaModal,
  onNavigateToClientes,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalPendentes: 0,
    totalAvisados: 0,
    totalVencidos: 0,
    totalPagos: 0,
    valorTotalMensal: 0,
    valorTotalRecebido: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/vendas/metrics');
      setMetrics(res.data);
    } catch {
      // Ignora erro passageiro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, []);

  const formatBRL = (val: number) => {
    return Number(val || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  return (
    <div>
      {/* Header com Saudações e Ações */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Visão Geral de Cobranças</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Acompanhe o faturamento mensal recorrente e status dos disparos de WhatsApp.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchMetrics} disabled={loading}>
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

        <div>
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

      {/* Grid de Cards de Estatísticas */}
      <div className="grid-cards">
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

      {/* Cards Financeiros & WhatsApp */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {/* Card Financeiro */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} color="var(--primary)" />
              <h4 style={{ fontSize: '1.05rem' }}>Faturamento Mensal Recorrente</h4>
            </div>
            <span className="badge badge-pago">Ciclo Atual</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Previsto</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff' }}>
                {formatBRL(metrics.valorTotalMensal)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Já Recebido</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#34d399' }}>
                {formatBRL(metrics.valorTotalRecebido)}
              </div>
            </div>
          </div>

          {/* Barra de Progresso de Recebimento */}
          {metrics.valorTotalMensal > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>Percentual recebido</span>
                <span>
                  {Math.round((metrics.valorTotalRecebido / metrics.valorTotalMensal) * 100)}%
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((metrics.valorTotalRecebido / metrics.valorTotalMensal) * 100))}%`,
                    background: 'var(--primary)',
                    borderRadius: '4px',
                    transition: 'width 300ms ease-out',
                  }}
                />
              </div>
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
              Ver Clientes & Vendas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
