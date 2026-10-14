import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { ContaPagar } from '../types/index.js';
import { api } from '../services/api.js';
import { extractErrorMessage } from '../utils/error.js';
import { useDialog } from '../utils/useDialog.js';

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
  const dialogRef = useDialog(isOpen, onClose, !saving);

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
      setError(extractErrorMessage(err, 'Erro ao salvar dívida / credor.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="conta-titulo">
      <div ref={dialogRef} className="modal-content" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h3 className="modal-title" id="conta-titulo">
            {contaToEdit ? 'Editar conta a pagar' : 'Nova conta a pagar'}
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
              <label className="form-label" htmlFor="conta-credor">
                Para quem
              </label>
              <input
                id="conta-credor"
                type="text"
                className="form-input"
                required
                value={nomeCredor}
                onChange={(e) => setNomeCredor(e.target.value)}
                placeholder="Fornecedor, credor ou pessoa"
                autoComplete="off"
              />
            </div>

            <div className="modal-form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="conta-valor">
                  Valor
                </label>
                <div className="input-with-affix">
                  <span className="input-affix input-affix-left">R$</span>
                  <input
                    id="conta-valor"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    className="form-input form-input-left"
                    required
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="conta-vencimento">
                  Vencimento <span className="label-optional">(opcional)</span>
                </label>
                <input
                  id="conta-vencimento"
                  type="date"
                  className="form-input"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="conta-descricao">
                Descrição <span className="label-optional">(opcional)</span>
              </label>
              <input
                id="conta-descricao"
                type="text"
                className="form-input"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: lote de telas, empréstimo"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="conta-observacoes">
                Observações <span className="label-optional">(opcional)</span>
              </label>
              <textarea
                id="conta-observacoes"
                className="form-textarea"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <label className="venda-ativa">
              <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
              <span>Esta conta já foi paga</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
