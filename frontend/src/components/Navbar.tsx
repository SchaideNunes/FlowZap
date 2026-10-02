import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { MessageSquare, Users, LayoutDashboard, LogOut, QrCode, Bell, Building2 } from 'lucide-react';
import { WhatsAppStatus } from '../types/index.js';

interface NavbarProps {
  currentTab: 'dashboard' | 'clientes' | 'contas-pagar' | 'notificacoes';
  onTabChange: (tab: 'dashboard' | 'clientes' | 'contas-pagar' | 'notificacoes') => void;
  whatsAppStatus: WhatsAppStatus['state'];
  onOpenWhatsAppModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  whatsAppStatus,
  onOpenWhatsAppModal,
}) => {
  const { user, logout } = useAuth();

  const getStatusBadge = () => {
    switch (whatsAppStatus) {
      case 'open':
        return (
          <span className="badge badge-pago" style={{ cursor: 'pointer' }} onClick={onOpenWhatsAppModal}>
            <span className="status-dot online"></span> WhatsApp Conectado
          </span>
        );
      case 'connecting':
        return (
          <span className="badge badge-avisado" style={{ cursor: 'pointer' }} onClick={onOpenWhatsAppModal}>
            <span className="status-dot connecting"></span> Conectando...
          </span>
        );
      default:
        return (
          <span className="badge badge-vencido" style={{ cursor: 'pointer' }} onClick={onOpenWhatsAppModal}>
            <span className="status-dot offline"></span> Conectar WhatsApp
          </span>
        );
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="brand" onClick={() => onTabChange('dashboard')}>
          <div className="brand-icon">
            <MessageSquare size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-title">FlowZap</span>
              <span className="brand-badge">Sede</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              Cobrança Recorrente WhatsApp
            </div>
          </div>
        </div>

        <div className="nav-actions">
          <div className="nav-tabs">
            <button
              className={`nav-tab ${currentTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onTabChange('dashboard')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LayoutDashboard size={16} /> Dashboard
              </span>
            </button>
            <button
              className={`nav-tab ${currentTab === 'clientes' ? 'active' : ''}`}
              onClick={() => onTabChange('clientes')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} /> Clientes & Vendas
              </span>
            </button>
            <button
              className={`nav-tab ${currentTab === 'contas-pagar' ? 'active' : ''}`}
              onClick={() => onTabChange('contas-pagar')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={16} /> Quem Devemos
              </span>
            </button>
            <button
              className={`nav-tab ${currentTab === 'notificacoes' ? 'active' : ''}`}
              onClick={() => onTabChange('notificacoes')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bell size={16} /> Notificações do Dia
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {getStatusBadge()}

            <button
              className="btn btn-secondary btn-sm"
              title="Escanear QR Code do WhatsApp"
              onClick={onOpenWhatsAppModal}
            >
              <QrCode size={16} />
            </button>

            <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>{user?.nome}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{user?.email}</div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                title="Sair do sistema"
                onClick={logout}
                style={{ padding: '6px' }}
              >
                <LogOut size={16} color="var(--danger)" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
