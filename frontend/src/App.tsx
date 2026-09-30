import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Login } from './views/Login.js';
import { Dashboard } from './views/Dashboard.js';
import { ClientesView } from './views/ClientesView.js';
import { NotificacoesView } from './views/NotificacoesView.js';
import { WhatsAppModal } from './components/WhatsAppModal.js';
import { DisparoModal } from './components/DisparoModal.js';
import { ClienteModal } from './components/ClienteModal.js';
import { VendaModal } from './components/VendaModal.js';
import { HistoricoModal } from './components/HistoricoModal.js';
import { Cliente, Venda, WhatsAppStatus } from './types/index.js';
import { api } from './services/api.js';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'clientes' | 'notificacoes'>('dashboard');

  // WhatsApp connection state
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppStatus['state']>('unknown');

  // Modals state
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isDisparoModalOpen, setIsDisparoModalOpen] = useState(false);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState<Cliente | null>(null);

  const [isVendaModalOpen, setIsVendaModalOpen] = useState(false);
  const [vendaClienteId, setVendaClienteId] = useState<number | undefined>(undefined);
  const [vendaToEdit, setVendaToEdit] = useState<Venda | null>(null);
  const [clienteList, setClienteList] = useState<Cliente[]>([]);

  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [historicoVenda, setHistoricoVenda] = useState<Venda | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Consulta periódica do status da conexão do WhatsApp
  const checkWhatsApp = async () => {
    try {
      const res = await api.get('/cobrancas/whatsapp-status');
      setWhatsAppStatus(res.data.state);
    } catch {
      setWhatsAppStatus('close');
    }
  };

  const loadAllClientes = async () => {
    try {
      const res = await api.get('/clientes');
      setClienteList(res.data);
    } catch {
      // Ignora erro
    }
  };

  useEffect(() => {
    if (user) {
      checkWhatsApp();
      loadAllClientes();
      const interval = setInterval(checkWhatsApp, 12000);
      return () => clearInterval(interval);
    }
  }, [user, refreshTrigger]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div style={{ color: 'var(--text-muted)' }}>Carregando FlowZap...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleOpenNovaVenda = (clienteId?: number) => {
    setVendaClienteId(clienteId);
    setVendaToEdit(null);
    setIsVendaModalOpen(true);
  };

  const handleEditVenda = (venda: Venda) => {
    setVendaToEdit(venda);
    setVendaClienteId(venda.cliente_id);
    setIsVendaModalOpen(true);
  };

  const handleEditCliente = (cliente: Cliente) => {
    setClienteToEdit(cliente);
    setIsClienteModalOpen(true);
  };

  const handleOpenHistorico = (venda: Venda) => {
    setHistoricoVenda(venda);
    setIsHistoricoModalOpen(true);
  };

  const handleDataChanged = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="app-container">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        whatsAppStatus={whatsAppStatus}
        onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
      />

      <main className="main-content">
        {currentTab === 'dashboard' ? (
          <Dashboard
            whatsAppStatus={whatsAppStatus}
            onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
            onOpenDisparoModal={() => setIsDisparoModalOpen(true)}
            onOpenNovoClienteModal={() => {
              setClienteToEdit(null);
              setIsClienteModalOpen(true);
            }}
            onOpenNovaVendaModal={() => handleOpenNovaVenda()}
            onNavigateToClientes={() => setCurrentTab('clientes')}
          />
        ) : currentTab === 'clientes' ? (
          <ClientesView
            onOpenNovoClienteModal={() => {
              setClienteToEdit(null);
              setIsClienteModalOpen(true);
            }}
            onEditCliente={handleEditCliente}
            onOpenNovaVendaModal={handleOpenNovaVenda}
            onEditVenda={handleEditVenda}
            onOpenHistoricoModal={handleOpenHistorico}
          />
        ) : (
          <NotificacoesView
            whatsAppStatus={whatsAppStatus}
            onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
            onOpenHistoricoModal={handleOpenHistorico}
          />
        )}
      </main>

      {/* Modais do Sistema */}
      <WhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        status={whatsAppStatus}
        onStatusChange={setWhatsAppStatus}
      />

      <DisparoModal
        isOpen={isDisparoModalOpen}
        onClose={() => setIsDisparoModalOpen(false)}
        onSuccess={handleDataChanged}
      />

      <ClienteModal
        isOpen={isClienteModalOpen}
        onClose={() => setIsClienteModalOpen(false)}
        clienteToEdit={clienteToEdit}
        onSuccess={handleDataChanged}
      />

      <VendaModal
        isOpen={isVendaModalOpen}
        onClose={() => setIsVendaModalOpen(false)}
        clienteId={vendaClienteId}
        clienteList={clienteList}
        vendaToEdit={vendaToEdit}
        onSuccess={handleDataChanged}
      />

      <HistoricoModal
        isOpen={isHistoricoModalOpen}
        onClose={() => setIsHistoricoModalOpen(false)}
        venda={historicoVenda}
      />
    </div>
  );
};
