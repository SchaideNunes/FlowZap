import React, { useState, useEffect } from 'react';
import { X, History, CheckCircle2, XCircle } from 'lucide-react';
import { HistoricoItem, Venda } from '../types/index.js';
import { api } from '../services/api.js';

interface HistoricoModalProps {
  isOpen: boolean;
  onClose: () => void;
  venda: Venda | null;
}

export const HistoricoModal: React.FC<HistoricoModalProps> = ({ isOpen, onClose, venda }) => {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && venda) {
      loadHistorico();
    }
  }, [isOpen, venda]);

  const loadHistorico = async () => {
    if (!venda) return;
    setLoading(true);
    try {
      const res = await api.get(`/vendas/${venda.id}/historico`);
      setHistorico(res.data);
    } catch {
      // Ignora erro
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !venda) return null;

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'lembrete_3d':
        return 'Lembrete (3 dias antes)';
      case 'lembrete_1d':
        return 'Lembrete (1 dia antes)';
      case 'vencido':
        return 'Aviso de Vencimento';
      case 'confirmacao_manual':
        return 'Confirmação de Pagamento';
      default:
        return tipo;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-lg">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={20} color="var(--primary)" />
            <h3 className="modal-title">
              Histórico de Mensagens — {venda.descricao || 'Cobrança'}
            </h3>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Carregando histórico...
            </div>
          ) : historico.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
              Nenhuma mensagem registrada até o momento para esta cobrança.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data & Hora</th>
                    <th>Tipo do Evento</th>
                    <th>Status</th>
                    <th>Conteúdo da Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item) => (
                    <tr key={item.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {formatDate(item.data_envio)}
                      </td>
                      <td style={{ fontWeight: 500 }}>{getTipoLabel(item.tipo)}</td>
                      <td>
                        {item.status_envio === 'enviado' ? (
                          <span className="badge badge-pago">
                            <CheckCircle2 size={12} /> Enviado
                          </span>
                        ) : (
                          <span className="badge badge-vencido">
                            <XCircle size={12} /> Falha
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {item.mensagem || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
