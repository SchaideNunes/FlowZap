import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Users, LayoutDashboard, LogOut, QrCode, Bell, Building2 } from 'lucide-react';
import { WhatsAppStatus } from '../types/index.js';
import { summarizeSede, SEDE_BADGE_CLASS, SEDE_DOT_CLASS } from '../utils/sede.js';

type Tab = 'dashboard' | 'clientes' | 'contas-pagar' | 'notificacoes';

interface NavbarProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  whatsAppInfo: WhatsAppStatus;
  onOpenWhatsAppModal: () => void;
}

// "short" é o rótulo da barra inferior no celular
const TABS: Array<{ id: Tab; label: string; short: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Visão geral', short: 'Início', icon: <LayoutDashboard size={16} /> },
  { id: 'clientes', label: 'Clientes e vendas', short: 'Clientes', icon: <Users size={16} /> },
  { id: 'contas-pagar', label: 'Quem devemos', short: 'A pagar', icon: <Building2 size={16} /> },
  { id: 'notificacoes', label: 'Notificações', short: 'Avisos', icon: <Bell size={16} /> },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  whatsAppInfo,
  onOpenWhatsAppModal,
}) => {
  const { user, logout } = useAuth();
  const whatsAppStatus = whatsAppInfo.state;
  // Painel online (ex.: Vercel): não envia mensagens, apenas mostra o estado da sede
  const isRemotePanel = whatsAppInfo.available === false;

  const getStatusBadge = () => {
    if (isRemotePanel) {
      const sede = summarizeSede(whatsAppInfo);
      return (
        <span className={`badge ${SEDE_BADGE_CLASS[sede.tone]} nav-status-pill`} title={sede.detail}>
          <span className={`status-dot ${SEDE_DOT_CLASS[sede.tone]}`} aria-hidden="true"></span>
          <span className="status-text-full">{sede.label}</span>
          <span className="status-text-short">{sede.short}</span>
        </span>
      );
    }

    const status =
      whatsAppStatus === 'open'
        ? { badge: 'badge-pago', dot: 'online', full: 'WhatsApp conectado', short: 'Conectado' }
        : whatsAppStatus === 'connecting'
          ? { badge: 'badge-avisado', dot: 'connecting', full: 'Conectando...', short: 'Conectando' }
          : { badge: 'badge-vencido', dot: 'offline', full: 'Conectar WhatsApp', short: 'Conectar' };

    return (
      <button
        type="button"
        className={`badge ${status.badge} nav-status-pill`}
        onClick={onOpenWhatsAppModal}
        title="Abrir a conexão do WhatsApp"
      >
        <span className={`status-dot ${status.dot}`} aria-hidden="true"></span>
        <span className="status-text-full">{status.full}</span>
        <span className="status-text-short">{status.short}</span>
      </button>
    );
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <button type="button" className="brand" onClick={() => onTabChange('dashboard')} title="Ir para a visão geral">
          <img src="/logo.webp" alt="" className="brand-logo" width={38} height={38} />
          <span className="brand-text-block">
            <span className="brand-title">{'A&V Store'}</span>
            <span className="brand-subtitle">
              FlowZap · {isRemotePanel ? 'Painel online' : 'Sede'}
            </span>
          </span>
        </button>

        {/* Abas no topo (computador) e barra inferior (celular) */}
        <div className="nav-tabs-wrapper">
          <div className="nav-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab ${currentTab === tab.id ? 'active' : ''}`}
                aria-current={currentTab === tab.id ? 'page' : undefined}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.icon}
                <span className="tab-label-full">{tab.label}</span>
                <span className="tab-label-short">{tab.short}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="nav-user-actions">
          {getStatusBadge()}

          {!isRemotePanel && (
            <button
              type="button"
              className="btn btn-secondary btn-sm nav-qr-btn"
              title="QR Code do WhatsApp"
              aria-label="QR Code do WhatsApp"
              onClick={onOpenWhatsAppModal}
            >
              <QrCode size={16} />
            </button>
          )}

          <div className="nav-user-profile">
            <div className="nav-user-text">
              <div className="nav-user-name">{user?.nome}</div>
              <div className="nav-user-email">{user?.email}</div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm nav-logout-btn"
              title="Sair do sistema"
              aria-label="Sair do sistema"
              onClick={logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
