import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Login } from './views/Login.js';
import { Dashboard } from './views/Dashboard.js';
import { ClientesView } from './views/ClientesView.js';
import { ContasPagarView } from './views/ContasPagarView.js';
import { NotificacoesView } from './views/NotificacoesView.js';
import { ResumoMensalView } from './views/ResumoMensalView.js';
import { WhatsAppModal } from './components/WhatsAppModal.js';
import { DisparoModal } from './components/DisparoModal.js';
import { ClienteModal } from './components/ClienteModal.js';
import { VendaModal } from './components/VendaModal.js';
import { HistoricoModal } from './components/HistoricoModal.js';
import { SedeLockBanner } from './components/SedeLockBanner.js';
import { Toast, ToastData } from './components/ui/Toast.js';
import { Cliente, Venda, WhatsAppStatus } from './types/index.js';
import { api } from './services/api.js';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'clientes' | 'contas-pagar' | 'notificacoes' | 'resumo'>('dashboard');

  // WhatsApp connection state
  const [whatsAppInfo, setWhatsAppInfo] = useState<WhatsAppStatus>({ state: 'unknown' });
  const whatsAppStatus = whatsAppInfo.state;
  // false quando o painel não está na máquina-sede (ex.: Vercel): não envia mensagens
  const sendingAvailable = whatsAppInfo.available !== false;
  const setWhatsAppStatus = (state: WhatsAppStatus['state']) =>
    setWhatsAppInfo((prev) => ({ ...prev, state }));

  // Modals state
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isDisparoModalOpen, setIsDisparoModalOpen] = useState(false);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState<Cliente | null>(null);
  // Venda feita sem cadastro que está sendo vinculada a um cliente novo
  const [vendasParaVincular, setVendasParaVincular] = useState<Venda[]>([]);

  const [isVendaModalOpen, setIsVendaModalOpen] = useState(false);
  const [vendaClienteId, setVendaClienteId] = useState<number | undefined>(undefined);
  const [vendaToEdit, setVendaToEdit] = useState<Venda | null>(null);
  const [clienteList, setClienteList] = useState<Cliente[]>([]);

  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [historicoVenda, setHistoricoVenda] = useState<Venda | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastSeq = useRef(0);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Consulta periódica do status da conexão do WhatsApp
  const checkWhatsApp = async () => {
    try {
      const res = await api.get('/cobrancas/whatsapp-status');
      setWhatsAppInfo({
        state: res.data.state,
        available: res.data.available,
        sede: res.data.sede,
        trava: res.data.trava,
      });
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
    setVendaClienteId(venda.cliente_id ?? undefined);
    setIsVendaModalOpen(true);
  };

  const handleEditCliente = (cliente: Cliente) => {
    setVendasParaVincular([]);
    setClienteToEdit(cliente);
    setIsClienteModalOpen(true);
  };

  const handleCadastrarClienteDaVenda = (vendas: Venda[]) => {
    setClienteToEdit(null);
    setVendasParaVincular(vendas);
    setIsClienteModalOpen(true);
  };

  // Depois de salvar o cliente, as vendas que estavam sem cadastro passam a ser dele
  const handleClienteSalvo = async (cliente?: Cliente) => {
    const vendas = vendasParaVincular;
    setVendasParaVincular([]);
    if (cliente && vendas.length > 0) {
      const resultados = await Promise.allSettled(
        vendas.map((venda) => api.put(`/vendas/${venda.id}`, { cliente_id: cliente.id, cliente_avulso: null }))
      );
      if (resultados.some((r) => r.status === 'rejected')) {
        setToast({
          id: ++toastSeq.current,
          tone: 'danger',
          message: 'O cliente foi cadastrado, mas nem todas as vendas foram passadas para ele. Tente de novo pela lista.',
        });
      }
    }
    handleDataChanged();
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
        whatsAppInfo={whatsAppInfo}
        onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
      />

      <main className="main-content">
        {whatsAppInfo.trava && !whatsAppInfo.trava.souSede && (
          <SedeLockBanner trava={whatsAppInfo.trava} onChanged={checkWhatsApp} />
        )}
        {currentTab === 'dashboard' ? (
          <Dashboard
            refreshKey={refreshTrigger}
            whatsAppInfo={whatsAppInfo}
            onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
            onOpenDisparoModal={() => setIsDisparoModalOpen(true)}
            onOpenNovoClienteModal={() => {
              setVendasParaVincular([]);
              setClienteToEdit(null);
              setIsClienteModalOpen(true);
            }}
            onOpenNovaVendaModal={() => handleOpenNovaVenda()}
            onNavigateToClientes={() => setCurrentTab('clientes')}
            onNavigateToContasPagar={() => setCurrentTab('contas-pagar')}
          />
        ) : currentTab === 'clientes' ? (
          <ClientesView
            refreshKey={refreshTrigger}
            onOpenNovoClienteModal={() => {
              setVendasParaVincular([]);
              setClienteToEdit(null);
              setIsClienteModalOpen(true);
            }}
            onEditCliente={handleEditCliente}
            onCadastrarClienteDaVenda={handleCadastrarClienteDaVenda}
            onOpenNovaVendaModal={handleOpenNovaVenda}
            onEditVenda={handleEditVenda}
            onOpenHistoricoModal={handleOpenHistorico}
          />
        ) : currentTab === 'contas-pagar' ? (
          <ContasPagarView />
        ) : currentTab === 'resumo' ? (
          <ResumoMensalView refreshKey={refreshTrigger} />
        ) : (
          <NotificacoesView
            refreshKey={refreshTrigger}
            whatsAppInfo={whatsAppInfo}
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
        isOpen={isDisparoModalOpen && sendingAvailable}
        onClose={() => setIsDisparoModalOpen(false)}
        onSuccess={handleDataChanged}
      />

      <ClienteModal
        isOpen={isClienteModalOpen}
        onClose={() => setIsClienteModalOpen(false)}
        clienteToEdit={clienteToEdit}
        initialNome={vendasParaVincular[0]?.cliente_avulso || undefined}
        onSuccess={handleClienteSalvo}
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

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
