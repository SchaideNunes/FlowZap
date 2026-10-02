import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save } from 'lucide-react';
import { ContaPagar } from '../types/index.js';
import { api } from '../services/api.js';

interface ContaPagarModalProps {
  isOpen: boolean;
  onClose: () => void;
  contaToEdit?: ContaPagar | null;
  onSuccess: () => void;
}

export const ContaPagarModal: React.FC<ContaPagarModalProps> = ({
  isOpen,
  onClose,
  contaToEdit,
  onSuccess,
}) => {
  const [nomeCredor, setNomeCredor] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [pago, setPago] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contaToEdit) {
      setNomeCredor(contaToEdit.nome_credor);
      setValor(contaToEdit.valor ? String(contaToEdit.valor) : '');
      setDescricao(contaToEdit.descricao || '');
      setDataVencimento(contaToEdit.data_vencimento ? contaToEdit.data_vencimento.split('T')[0] : '');
      setPago(contaToEdit.pago);
      setObservacoes(contaToEdit.observacoes || '');
    } else {
      setNomeCredor('');
      setValor('');
      setDescricao('');
      setDataVencimento('');
      setPago(false);
      setObservacoes('');
    }
    setError(null);
  }, [contaToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const numValor = parseFloat(valor.replace(',', '.'));
    if (isNaN(numValor) || numValor <= 0) {
      setError('Informe um valor válido e positivo.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        nome_credor: nomeCredor.trim(),
        valor: numValor,
        descricao: descricao.trim() || null,
        data_vencimento: dataVencimento || null,
        pago,
        observacoes: observacoes.trim() || null,
      };

      if (contaToEdit) {
        await api.put(`/contas-pagar/${contaToEdit.id}`, payload);
      } else {
        await api.post('/contas-pagar', payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar dívida / credor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={20} color="#f87171" />
            <h3 className="modal-title">
              {contaToEdit ? 'Editar Conta a Pagar' : 'Cadastrar Quem Devemos'}
            </h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  background: 'var(--danger-light)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                }}
              >
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Nome de Quem Devemos (Credor / Fornecedor) *</label>
              <input
                type="text"
                className="form-input"
                required
                value={nomeCredor}
                onChange={(e) => setNomeCredor(e.target.value)}
                placeholder="Ex: CRISTE (PARCELADO), JOSA, FORNECEDOR PEÇAS..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Valor (R$) *</label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-dim)',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                  }}
                >
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Data de Vencimento / Pagamento (Opcional)</label>
              <input
                type="date"
                className="form-input"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Descrição / Motivo (Opcional)</label>
              <input
                type="text"
                className="form-input"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Lote de telas, empréstimo, parcelamento..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Observações Livres (Opcional)</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Pagamento via Pix dia 15..."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.75rem' }}>
              <input
                type="checkbox"
                id="conta-paga"
                checked={pago}
                onChange={(e) => setPago(e.target.checked)}
              />
              <label htmlFor="conta-paga" style={{ fontSize: '0.875rem', color: '#fff', cursor: 'pointer' }}>
                Esta dívida já foi totalmente paga / liquidada
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
