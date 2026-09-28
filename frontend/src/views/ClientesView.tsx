import React, { useState, useEffect } from 'react';
import {
  Search,
  UserPlus,
  PlusCircle,
  CheckCircle2,
  ExternalLink,
  Edit2,
  History,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  DollarSign,
  Phone,
} from 'lucide-react';
import { Cliente, Venda } from '../types/index.js';
import { api } from '../services/api.js';

interface ClientesViewProps {
  onOpenNovoClienteModal: () => void;
  onEditCliente: (cliente: Cliente) => void;
  onOpenNovaVendaModal: (clienteId: number) => void;
  onEditVenda: (venda: Venda) => void;
  onOpenHistoricoModal: (venda: Venda) => void;
}

export const ClientesView: React.FC<ClientesViewProps> = ({
  onOpenNovoClienteModal,
  onEditCliente,
  onOpenNovaVendaModal,
  onEditVenda,
  onOpenHistoricoModal,
}) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [search, setSearch] = useState('');
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingVendas, setLoadingVendas] = useState(false);
  const [payingVendaId, setPayingVendaId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const fetchClientes = async (query?: string) => {
    setLoadingClientes(true);
    try {
      const url = query ? `/clientes?busca=${encodeURIComponent(query)}` : '/clientes';
      const res = await api.get(url);
      setClientes(res.data);
      if (res.data.length > 0 && !selectedCliente) {
        setSelectedCliente(res.data[0]);
      } else if (selectedCliente) {
        // Atualiza a referência do cliente selecionado se ele ainda existir
        const updated = res.data.find((c: Cliente) => c.id === selectedCliente.id);
        if (updated) setSelectedCliente(updated);
      }
    } catch {
      // Ignora erro passageiro
    } finally {
      setLoadingClientes(false);
    }
  };

  const fetchVendasDoCliente = async (clienteId: number) => {
    setLoadingVendas(true);
    try {
      const res = await api.get(`/vendas/cliente/${clienteId}`);
      setVendas(res.data);
    } catch {
      // Ignora erro
    } finally {
      setLoadingVendas(false);
    }
  };

  useEffect(() => {
    fetchClientes(search);
  }, [search]);

  useEffect(() => {
    if (selectedCliente) {
      fetchVendasDoCliente(selectedCliente.id);
    } else {
      setVendas([]);
    }
  }, [selectedCliente]);

  const handleMarkAsPaid = async (venda: Venda) => {
    const confirm = window.confirm(
      `Confirmar recebimento do pagamento de "${venda.descricao}" (R$ ${Number(venda.valor).toFixed(2)})?\n\nIsso calculará o próximo ciclo de vencimento (+1 mês) e resetará o status para pendente.`
    );
    if (!confirm) return;

    setPayingVendaId(venda.id);
    try {
      await api.patch(`/vendas/${venda.id}/pago`);
      setFeedbackMsg(`Pagamento de "${venda.descricao}" confirmado! Próximo ciclo gerado.`);
      setTimeout(() => setFeedbackMsg(null), 4000);
      if (selectedCliente) {
        fetchVendasDoCliente(selectedCliente.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao registrar pagamento.');
    } finally {
      setPayingVendaId(null);
    }
  };

  const handleToggleVendaAtivo = async (venda: Venda) => {
    try {
      await api.patch(`/vendas/${venda.id}/status`, { ativo: !venda.ativo });
      if (selectedCliente) {
        fetchVendasDoCliente(selectedCliente.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar status da cobrança.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <span className="badge badge-pago">Pago</span>;
      case 'avisado_3d':
        return <span className="badge badge-avisado">Avisado 3d</span>;
      case 'avisado_1d':
        return <span className="badge badge-avisado">Avisado 1d</span>;
      case 'vencido':
        return <span className="badge badge-vencido">Vencido</span>;
      default:
        return <span className="badge badge-pendente">Pendente</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div>
      {/* Barra de Ações Superior */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>Clientes & Cobranças</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Cada cliente pode possuir múltiplos planos/vendas ativos com vencimentos independentes.
          </p>
        </div>

        <button className="btn btn-primary" onClick={onOpenNovoClienteModal}>
          <UserPlus size={16} />
          Cadastrar Novo Cliente
        </button>
      </div>

      {feedbackMsg && (
        <div
          style={{
            background: 'var(--primary-light)',
            border: '1px solid var(--primary)',
            color: '#34d399',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.875rem',
          }}
        >
          <CheckCircle2 size={18} />
          {feedbackMsg}
        </div>
      )}

      {/* Grid Principal: Lista de Clientes (Esquerda) e Detalhes / Vendas (Direita) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 360px) 1fr',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* Painel Esquerdo: Busca e Lista de Clientes */}
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente por nome..."
              style={{ paddingLeft: '2.4rem', fontSize: '0.85rem' }}
            />
            <Search
              size={16}
              color="var(--text-dim)"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '680px', overflowY: 'auto' }}>
            {loadingClientes ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                Carregando clientes...
              </div>
            ) : clientes.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Nenhum cliente encontrado.
              </div>
            ) : (
              clientes.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCliente(c)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: selectedCliente?.id === c.id ? 'var(--primary)' : 'var(--border-subtle)',
                    background: selectedCliente?.id === c.id ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-main)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{c.nome}</span>
                    <span className="badge badge-pendente" style={{ fontSize: '0.7rem' }}>
                      {c.vendas_ativas_count || 0} {c.vendas_ativas_count === 1 ? 'venda' : 'vendas'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <Phone size={12} />
                    <span>{c.whatsapp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Painel Direito: Detalhes do Cliente Selecionado e Tabela de Vendas */}
        <div>
          {selectedCliente ? (
            <div>
              {/* Card de Dados Cadastrais do Cliente */}
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '1.35rem' }}>{selectedCliente.nome}</h3>
                      {selectedCliente.ativo ? (
                        <span className="badge badge-pago">Ativo</span>
                      ) : (
                        <span className="badge badge-vencido">Inativo</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={14} /> {selectedCliente.whatsapp}
                      </span>
                      <a
                        href={`https://wa.me/${selectedCliente.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                      >
                        Abrir WhatsApp <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onEditCliente(selectedCliente)}
                    >
                      <Edit2 size={14} /> Editar Cliente
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onOpenNovaVendaModal(selectedCliente.id)}
                    >
                      <PlusCircle size={14} /> Nova Cobrança
                    </button>
                  </div>
                </div>

                {selectedCliente.observacoes && (
                  <div
                    style={{
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '0.825rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <b style={{ color: '#fff' }}>Anotações:</b> {selectedCliente.observacoes}
                  </div>
                )}
              </div>

              {/* Tabela de Vendas / Cobranças do Cliente */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem' }}>Cobranças & Planos Recorrentes</h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Vencimentos mensais calculados individualmente para este cliente
                    </p>
                  </div>
                  <span className="badge badge-pendente">
                    {vendas.length} {vendas.length === 1 ? 'cobrança cadastrada' : 'cobranças cadastradas'}
                  </span>
                </div>

                {loadingVendas ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    Carregando cobranças...
                  </div>
                ) : vendas.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-main)', borderRadius: '8px' }}>
                    <DollarSign size={36} color="var(--primary)" style={{ margin: '0 auto 0.5rem auto' }} />
                    <div style={{ fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                      Nenhuma cobrança ativa para este cliente
                    </div>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Adicione um plano mensal, produto ou serviço para iniciar o monitoramento e lembretes de WhatsApp.
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onOpenNovaVendaModal(selectedCliente.id)}
                    >
                      <PlusCircle size={14} /> Adicionar Primeira Cobrança
                    </button>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Descrição</th>
                          <th>Valor Mensal</th>
                          <th>Dia Fixo</th>
                          <th>Vencimento Atual</th>
                          <th>Status Ciclo</th>
                          <th style={{ textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendas.map((v) => (
                          <tr key={v.id} style={{ opacity: v.ativo ? 1 : 0.55 }}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{v.descricao}</div>
                              {!v.ativo && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>
                                  (Cobrança Encerrada / Pausada)
                                </span>
                              )}
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                              R$ {Number(v.valor).toFixed(2).replace('.', ',')}
                            </td>
                            <td>Todo dia {v.dia_vencimento}</td>
                            <td style={{ fontWeight: 500 }}>{formatDate(v.data_vencimento_atual)}</td>
                            <td>{getStatusBadge(v.status_mes_atual)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                {v.ativo && (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    title="Marcar como pago (gera próximo ciclo mensal)"
                                    onClick={() => handleMarkAsPaid(v)}
                                    disabled={payingVendaId === v.id}
                                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                  >
                                    <CheckCircle2 size={13} />
                                    {payingVendaId === v.id ? 'Salvando...' : 'Marcar Pago'}
                                  </button>
                                )}

                                <button
                                  className="btn btn-secondary btn-sm"
                                  title="Ver histórico de mensagens WhatsApp"
                                  onClick={() => onOpenHistoricoModal(v)}
                                  style={{ padding: '4px 8px' }}
                                >
                                  <History size={13} />
                                </button>

                                <button
                                  className="btn btn-secondary btn-sm"
                                  title="Editar parâmetros da cobrança"
                                  onClick={() => onEditVenda(v)}
                                  style={{ padding: '4px 8px' }}
                                >
                                  <Edit2 size={13} />
                                </button>

                                <button
                                  className="btn btn-secondary btn-sm"
                                  title={v.ativo ? 'Encerrar / Pausar cobrança' : 'Reativar cobrança'}
                                  onClick={() => handleToggleVendaAtivo(v)}
                                  style={{ padding: '4px 8px' }}
                                >
                                  {v.ativo ? (
                                    <ToggleRight size={15} color="var(--primary)" />
                                  ) : (
                                    <ToggleLeft size={15} color="var(--text-dim)" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 0.75rem auto' }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
                Nenhum cliente selecionado
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                Selecione um cliente na lista à esquerda ou cadastre um novo cliente para gerenciar suas vendas.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
