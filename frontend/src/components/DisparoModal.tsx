import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { ReminderPreviewItem } from '../types/index.js';
import { api } from '../services/api.js';

interface DisparoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DisparoModal: React.FC<DisparoModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [items, setItems] = useState<ReminderPreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPreview();
      setSentSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/cobrancas/preview');
      setItems(res.data);
    } catch (err: any) {
      setError('Erro ao carregar pré-visualização das cobranças.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarDisparo = async () => {
    setSending(true);
    setError(null);
    try {
      await api.post('/cobrancas/disparar');
      setSentSuccess(true);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao iniciar disparo de cobranças.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'lembrete_3d':
        return <span className="badge badge-avisado">Vence em 3 dias</span>;
      case 'lembrete_1d':
        return <span className="badge badge-avisado">Vence amanhã</span>;
      case 'vencido':
        return <span className="badge badge-vencido">Vencido</span>;
      default:
        return <span className="badge badge-pendente">{tipo}</span>;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-lg">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={20} color="var(--primary)" />
            <h3 className="modal-title">Disparar Cobranças de Hoje</h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={sending}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {sentSuccess ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <CheckCircle size={52} color="var(--primary)" style={{ margin: '0 auto 1rem auto' }} />
              <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Envios Iniciados com Sucesso!</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                As cobranças foram adicionadas à fila de envio segura com intervalos anti-ban (8 a 20 segundos entre cada envio) e simulação de digitação humana.
              </p>
              <button className="btn btn-primary" onClick={onClose}>
                Entendido
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                    Clientes a serem contatados hoje
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Confira a lista abaixo antes de confirmar o disparo via WhatsApp
                  </div>
                </div>
                <div className="badge badge-pendente" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                  {items.length} {items.length === 1 ? 'cliente elegível' : 'clientes elegíveis'}
                </div>
              </div>

              {error && (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--danger-light)', padding: '8px 12px', borderRadius: '8px' }}>
                  {error}
                </div>
              )}

              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Carregando pré-visualização...
                </div>
              ) : items.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-input)', borderRadius: '10px' }}>
                  <Clock size={36} color="var(--primary)" style={{ margin: '0 auto 0.75rem auto' }} />
                  <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>Nenhuma cobrança pendente para hoje</div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    Todas as cobranças do ciclo atual já foram enviadas ou ainda não atingiram o momento de lembrete (3 dias antes, 1 dia antes ou no dia do vencimento).
                  </div>
                </div>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: '350px' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>WhatsApp</th>
                        <th>Venda / Cobrança</th>
                        <th>Valor</th>
                        <th>Vencimento</th>
                        <th>Tipo</th>
                        <th>Mensagem Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{item.clienteNome}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.whatsapp}</td>
                          <td>{item.descricao || 'Cobrança'}</td>
                          <td style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            R$ {Number(item.valor).toFixed(2).replace('.', ',')}
                          </td>
                          <td>{item.dataVencimento}</td>
                          <td>{getTipoBadge(item.tipo)}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '250px' }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.mensagem}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {items.length > 0 && (
                <div style={{ marginTop: '1.25rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '10px 14px', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Ao clicar em confirmar, as mensagens serão enviadas uma a uma com intervalo de segurança de 8 a 20 segundos entre cada cliente para proteção contra banimento.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!sentSuccess && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={sending}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmarDisparo}
              disabled={sending || loading || items.length === 0}
            >
              <Send size={16} />
              {sending ? 'Iniciando envio...' : `Confirmar e Enviar (${items.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
