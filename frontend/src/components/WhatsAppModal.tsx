import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Smartphone, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api.js';

import { WhatsAppStatus } from '../types/index.js';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: WhatsAppStatus['state'];
  onStatusChange: (status: WhatsAppStatus['state']) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusChange,
}) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  // silent: renovação automática do QR (ele expira em ~20s) sem piscar o indicador de carregamento
  const fetchQrCode = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get('/cobrancas/whatsapp-qrcode');
      if (res.data?.qrcode) {
        setQrCode(res.data.qrcode);
      }
      if (res.data?.state) {
        onStatusChange(res.data.state);
      }
    } catch (err: any) {
      setError('Não foi possível obter o QR Code. Verifique se o sistema da máquina-sede está ligado e acesse o painel por ele.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const res = await api.get('/cobrancas/whatsapp-status');
      onStatusChange(res.data.state);
    } catch {
      // Ignora erro passageiro de verificação
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQrCode();
      const interval = setInterval(checkStatus, 4000);
      const qrInterval = setInterval(() => {
        if (statusRef.current !== 'open') fetchQrCode(true);
      }, 15000);
      return () => {
        clearInterval(interval);
        clearInterval(qrInterval);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Smartphone size={20} color="var(--primary)" />
            <h3 className="modal-title">Conexão WhatsApp</h3>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center' }}>
          {status === 'open' ? (
            <div style={{ padding: '2rem 1rem' }}>
              <div style={{ color: 'var(--success)', marginBottom: '1rem' }}>
                <CheckCircle2 size={56} style={{ margin: '0 auto' }} />
              </div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>WhatsApp Conectado com Sucesso!</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                O sistema está pronto para enviar os lembretes automáticos e manuais através da máquina-sede. A sessão fica salva localmente.
              </p>
              <div className="badge badge-pago" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                <span className="status-dot online"></span> Instância Ativa & Autenticada
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Abra o WhatsApp no seu celular, vá em <b>Aparelhos conectados</b> &gt; <b>Conectar um aparelho</b> e aponte para o QR Code abaixo:
              </p>

              <div
                style={{
                  background: '#fff',
                  padding: '16px',
                  borderRadius: '12px',
                  display: 'inline-block',
                  margin: '0 auto 1.25rem auto',
                  minWidth: '240px',
                  minHeight: '240px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
              >
                {loading ? (
                  <div style={{ color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
                    <RefreshCw className="animate-spin" size={32} />
                  </div>
                ) : qrCode ? (
                  <img
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    style={{ width: '220px', height: '220px', display: 'block' }}
                  />
                ) : (
                  <div style={{ color: '#666', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                    {error || 'Clique em Atualizar para gerar o QR Code'}
                  </div>
                )}
              </div>

              {error && (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--danger-light)', padding: '8px 12px', borderRadius: '8px' }}>
                  {error}
                </div>
              )}

              <div style={{ background: 'rgba(var(--neutral-rgb), 0.05)', border: '1px solid rgba(var(--neutral-rgb), 0.12)', borderRadius: '8px', padding: '10px 14px', textAlign: 'left', display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '0 0 1rem 0' }}>
                <ShieldCheck size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <b style={{ color: '#fff' }}>Recomendação Anti-Ban:</b> Utilize um chip/número exclusivo para o negócio. O Flow-Zap já gerencia delays automáticos (8-20s) e simulação de presença humana para segurança do seu número.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {status !== 'open' && (
            <button className="btn btn-secondary btn-sm" onClick={() => fetchQrCode()} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar QR Code
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
