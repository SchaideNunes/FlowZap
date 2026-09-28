import React, { useState, useEffect } from 'react';
import { X, CreditCard, Save } from 'lucide-react';
import { Venda, Cliente } from '../types/index.js';
import { api } from '../services/api.js';

interface VendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId?: number;
  clienteList?: Cliente[];
  vendaToEdit?: Venda | null;
  onSuccess: () => void;
}

export const VendaModal: React.FC<VendaModalProps> = ({
  isOpen,
  onClose,
  clienteId,
  clienteList = [],
  vendaToEdit,
  onSuccess,
}) => {
  const [selectedClienteId, setSelectedClienteId] = useState<number>(clienteId || 0);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vendaToEdit) {
      setSelectedClienteId(vendaToEdit.cliente_id);
      setDescricao(vendaToEdit.descricao || '');
      setValor(String(vendaToEdit.valor));
      setDiaVencimento(String(vendaToEdit.dia_vencimento));
      setAtivo(vendaToEdit.ativo);
    } else {
      setSelectedClienteId(clienteId || (clienteList[0]?.id ?? 0));
      setDescricao('');
      setValor('');
      setDiaVencimento('10');
      setAtivo(true);
    }
    setError(null);
  }, [vendaToEdit, clienteId, clienteList, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const parsedValor = parseFloat(valor.replace(',', '.'));
    const parsedDia = parseInt(diaVencimento, 10);

    if (isNaN(parsedValor) || parsedValor <= 0) {
      setError('Informe um valor válido maior que zero.');
      setSaving(false);
      return;
    }

    if (isNaN(parsedDia) || parsedDia < 1 || parsedDia > 31) {
      setError('O dia de vencimento deve estar entre 1 e 31.');
      setSaving(false);
      return;
    }

    try {
      if (vendaToEdit) {
        await api.put(`/vendas/${vendaToEdit.id}`, {
          descricao,
          valor: parsedValor,
          dia_vencimento: parsedDia,
          ativo,
        });
      } else {
        await api.post('/vendas', {
          cliente_id: selectedClienteId,
          descricao,
          valor: parsedValor,
          dia_vencimento: parsedDia,
          ativo,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar cobrança.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} color="var(--primary)" />
            <h3 className="modal-title">
              {vendaToEdit ? 'Editar Cobrança / Venda' : 'Adicionar Nova Cobrança Recorrente'}
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

            {!clienteId && clienteList.length > 0 && !vendaToEdit && (
              <div className="form-group">
                <label className="form-label">Cliente Vinculado *</label>
                <select
                  className="form-select"
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(Number(e.target.value))}
                  required
                >
                  {clienteList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.whatsapp})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Descrição do Plano / Produto *</label>
              <input
                type="text"
                className="form-input"
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Mensalidade Pro, Hospedagem VIP, Manutenção"
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Aparece na mensagem do WhatsApp para identificar o serviço.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Valor Mensal (R$) *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="Ex: 150,00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dia do Vencimento (1 a 31) *</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  className="form-input"
                  required
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value)}
                  placeholder="Ex: 10"
                />
              </div>
            </div>

            {vendaToEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="venda-ativo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                />
                <label htmlFor="venda-ativo" style={{ fontSize: '0.875rem', color: '#fff', cursor: 'pointer' }}>
                  Cobrança Ativa (desmarque para encerrar cobrança sem excluir o cliente)
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
              {saving ? 'Salvando...' : 'Salvar Cobrança'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
