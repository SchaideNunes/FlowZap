import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import { Cliente } from '../types/index.js';
import { api } from '../services/api.js';
import { maskPhone } from '../utils/phone.js';

interface ClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteToEdit?: Cliente | null;
  onSuccess: () => void;
}

export const ClienteModal: React.FC<ClienteModalProps> = ({
  isOpen,
  onClose,
  clienteToEdit,
  onSuccess,
}) => {
  const [nome, setNome] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clienteToEdit) {
      setNome(clienteToEdit.nome);
      const { display, digits } = maskPhone(clienteToEdit.whatsapp);
      setPhoneDisplay(display);
      setPhoneDigits(digits);
      setObservacoes(clienteToEdit.observacoes || '');
      setAtivo(clienteToEdit.ativo);
    } else {
      setNome('');
      setPhoneDisplay('');
      setPhoneDigits('');
      setObservacoes('');
      setAtivo(true);
    }
    setError(null);
  }, [clienteToEdit, isOpen]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { display, digits } = maskPhone(e.target.value);
    setPhoneDisplay(display);
    setPhoneDigits(digits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (phoneDigits.length < 10) {
      setError('Informe o DDD e o número completo (ex: 75 99150-3949)');
      setSaving(false);
      return;
    }

    const cleanWhatsapp = '55' + phoneDigits;

    try {
      if (clienteToEdit) {
        await api.put(`/clientes/${clienteToEdit.id}`, {
          nome,
          whatsapp: cleanWhatsapp,
          observacoes: observacoes || null,
          ativo,
        });
      } else {
        await api.post('/clientes', {
          nome,
          whatsapp: cleanWhatsapp,
          observacoes: observacoes || null,
          ativo,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={20} color="var(--primary)" />
            <h3 className="modal-title">
              {clienteToEdit ? 'Editar Dados do Cliente' : 'Cadastrar Novo Cliente'}
            </h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--danger-light)', padding: '8px 12px', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Nome Completo *</label>
              <input
                type="text"
                className="form-input"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
              />
            </div>

            <div className="form-group">
              <label className="form-label">WhatsApp *</label>
              <div className="input-phone-group">
                <span className="input-phone-prefix" title="Código do Brasil (+55) fixo">
                  +55 🇧🇷
                </span>
                <input
                  type="tel"
                  className="form-input"
                  required
                  value={phoneDisplay}
                  onChange={handlePhoneChange}
                  placeholder="(75) 99150-3949"
                  maxLength={15}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Digite o DDD e o número (ex: 75991503949). O código +55 do Brasil já fica cravado automaticamente.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observações Livres (Opcional)</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Prefere contato após as 14h, cliente desde 2024..."
              />
            </div>

            {clienteToEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="cliente-ativo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                />
                <label htmlFor="cliente-ativo" style={{ fontSize: '0.875rem', color: '#fff', cursor: 'pointer' }}>
                  Cliente Ativo na Base
                </label>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
