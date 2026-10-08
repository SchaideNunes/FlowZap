import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { MessageSquare, Users, LayoutDashboard, LogOut, QrCode, Bell, Building2 } from 'lucide-react';
import { WhatsAppStatus } from '../types/index.js';
import { summarizeSede, SEDE_BADGE_CLASS, SEDE_DOT_CLASS } from '../utils/sede.js';

interface NavbarProps {
  currentTab: 'dashboard' | 'clientes' | 'contas-pagar' | 'notificacoes';
  onTabChange: (tab: 'dashboard' | 'clientes' | 'contas-pagar' | 'notificacoes') => void;
  whatsAppInfo: WhatsAppStatus;
  onOpenWhatsAppModal: () => void;
}

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
          <span className={`status-dot ${SEDE_DOT_CLASS[sede.tone]}`}></span>
          <span className="status-text-full">{sede.label}</span>
          <span className="status-text-short">{sede.short}</span>
        </span>
      );
    }

    switch (whatsAppStatus) {
      case 'open':
        return (
          <span className="badge badge-pago nav-status-pill" style={{ cursor: 'pointer' }} onClick={onOpenWhatsAppModal}>
            <span className="status-dot online"></span>
            <span className="status-text-full">WhatsApp Conectado</span>
            <span className="status-text-short">Conectado</span>
          </span>
        );
      case 'connecting':
        return (
          <span className="badge badge-avisado nav-status-pill" style={{ cursor: 'pointer' }} onClick={onOpenWhatsAppModal}>
            <span className="status-dot connecting"></span>
            <span className="status-text-full">Conectando...</span>
            <span className="status-text-short">Conectando</span>
          </span>
        );
      default:
        return (
          <span className="badge badge-vencido nav-status-pill" style={{ cursor: 'pointer' }} onClick={onOpenWhatsAppModal}>
            <span className="status-dot offline"></span>
            <span className="status-text-full">Conectar WhatsApp</span>
            <span className="status-text-short">Conectar</span>
          </span>
        );
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="brand" onClick={() => onTabChange('dashboard')}>
          <div className="brand-icon">
            <MessageSquare size={22} />
          </div>
          <div className="brand-text-block">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-title">FlowZap</span>
              <span className="brand-badge">{isRemotePanel ? 'Online' : 'Sede'}</span>
            </div>
            <div className="brand-subtitle">
              Cobrança Recorrente WhatsApp
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Row 2 on tablet/mobile, centered on desktop) */}
        <div className="nav-tabs-wrapper">
          <div className="nav-tabs">
            <button
              className={`nav-tab ${currentTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onTabChange('dashboard')}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
            <button
              className={`nav-tab ${currentTab === 'clientes' ? 'active' : ''}`}
              onClick={() => onTabChange('clientes')}
            >
              <Users size={16} />
              <span>Clientes & Vendas</span>
            </button>
            <button
              className={`nav-tab ${currentTab === 'contas-pagar' ? 'active' : ''}`}
              onClick={() => onTabChange('contas-pagar')}
            >
              <Building2 size={16} />
              <span>Quem Devemos</span>
            </button>
            <button
              className={`nav-tab ${currentTab === 'notificacoes' ? 'active' : ''}`}
              onClick={() => onTabChange('notificacoes')}
            >
              <Bell size={16} />
              <span>Notificações do Dia</span>
            </button>
          </div>
        </div>

        {/* User Controls & Connection Status */}
        <div className="nav-user-actions">
          {getStatusBadge()}

          {!isRemotePanel && (
            <button
              className="btn btn-secondary btn-sm nav-qr-btn"
              title="Escanear QR Code do WhatsApp"
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
              className="btn btn-secondary btn-sm nav-logout-btn"
              title="Sair do sistema"
              onClick={logout}
            >
              <LogOut size={16} color="var(--danger)" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
