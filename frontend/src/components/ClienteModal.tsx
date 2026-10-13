import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Cliente } from '../types/index.js';
import { api } from '../services/api.js';
import { maskPhone } from '../utils/phone.js';
import { extractErrorMessage } from '../utils/error.js';
import { useDialog } from '../utils/useDialog.js';

interface ClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteToEdit?: Cliente | null;
  /** Nome já preenchido ao cadastrar quem comprou sem cadastro. */
  initialNome?: string;
  /** Recebe o cliente salvo (útil para vincular uma venda ao cadastro novo). */
  onSuccess: (cliente?: Cliente) => void;
}

export const ClienteModal: React.FC<ClienteModalProps> = ({
  isOpen,
  onClose,
  clienteToEdit,
  initialNome,
  onSuccess,
}) => {
  const [nome, setNome] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialog(isOpen, onClose, !saving);

  useEffect(() => {
    if (clienteToEdit) {
      setNome(clienteToEdit.nome);
      const { display, digits } = maskPhone(clienteToEdit.whatsapp);
      setPhoneDisplay(display);
      setPhoneDigits(digits);
      setObservacoes(clienteToEdit.observacoes || '');
      setAtivo(clienteToEdit.ativo);
    } else {
      setNome(initialNome || '');
      setPhoneDisplay('');
      setPhoneDigits('');
      setObservacoes('');
      setAtivo(true);
    }
    setError(null);
  }, [clienteToEdit, initialNome, isOpen]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { display, digits } = maskPhone(e.target.value);
    setPhoneDisplay(display);
    setPhoneDigits(digits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (phoneDigits.length < 10) {
      setError('Informe o DDD e o número completo do WhatsApp.');
      return;
    }

    setSaving(true);
    const payload = {
      nome: nome.trim(),
      whatsapp: '55' + phoneDigits,
      observacoes: observacoes.trim() || null,
      ativo,
    };

    try {
      const res = clienteToEdit
        ? await api.put(`/clientes/${clienteToEdit.id}`, payload)
        : await api.post('/clientes', payload);
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Erro ao salvar o cliente.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cliente-titulo">
      <div ref={dialogRef} className="modal-content" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h3 className="modal-title" id="cliente-titulo">
            {clienteToEdit ? 'Editar cliente' : 'Novo cliente'}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body venda-form">
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="cliente-nome">
                Nome
              </label>
              <input
                id="cliente-nome"
                type="text"
                className="form-input"
                required
                minLength={2}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do cliente"
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cliente-whatsapp">
                WhatsApp
              </label>
              <div className="input-phone-group">
                <span className="input-phone-prefix">+55</span>
                <input
                  id="cliente-whatsapp"
                  type="tel"
                  inputMode="numeric"
                  className="form-input"
                  required
                  value={phoneDisplay}
                  onChange={handlePhoneChange}
                  placeholder="(11) 91234-5678"
                  maxLength={15}
                  autoComplete="off"
                />
              </div>
              <span className="form-hint">DDD e número. É para este número que os avisos são enviados.</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cliente-observacoes">
                Observações <span className="label-optional">(opcional)</span>
              </label>
              <textarea
                id="cliente-observacoes"
                className="form-textarea"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            {clienteToEdit && (
              <label className="venda-ativa">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                <span>Cliente ativo (desmarque para parar os avisos dele)</span>
              </label>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
