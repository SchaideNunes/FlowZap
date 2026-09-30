import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Save, Percent } from 'lucide-react';
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
  const [valorTotal, setValorTotal] = useState('');
  const [taxaJuros, setTaxaJuros] = useState('');
  const [totalParcelas, setTotalParcelas] = useState('1');
  const [parcelaAtual, setParcelaAtual] = useState('1');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cálculos dinâmicos em tempo real
  const numBase = parseFloat(valorTotal.replace(/\./g, '').replace(',', '.')) || 0;
  const numJurosPct = parseFloat(taxaJuros.replace(',', '.')) || 0;
  const valorJurosCalculado = numBase * (numJurosPct / 100);
  const totalComJuros = numBase + valorJurosCalculado;
  const numParcelas = Math.max(1, parseInt(totalParcelas, 10) || 1);
  const valorCadaParcela = numParcelas > 0 ? (totalComJuros / numParcelas) : 0;

  useEffect(() => {
    if (vendaToEdit) {
      setSelectedClienteId(vendaToEdit.cliente_id);
      setDescricao(vendaToEdit.descricao || '');
      setDiaVencimento(String(vendaToEdit.dia_vencimento));
      setAtivo(vendaToEdit.ativo);

      const parcelas = vendaToEdit.total_parcelas || 1;
      setTotalParcelas(String(parcelas));
      setParcelaAtual(String(vendaToEdit.parcela_atual || 1));
      setTaxaJuros(vendaToEdit.taxa_juros ? String(vendaToEdit.taxa_juros) : '');

      const vTot = vendaToEdit.valor_total || (vendaToEdit.valor * parcelas);
      setValorTotal(vTot.toFixed(2).replace('.', ','));
    } else {
      setSelectedClienteId(clienteId || (clienteList[0]?.id ?? 0));
      setDescricao('');
      setValorTotal('');
      setTaxaJuros('');
      setTotalParcelas('1');
      setParcelaAtual('1');
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

    const parsedDia = parseInt(diaVencimento, 10);
    if (isNaN(parsedDia) || parsedDia < 1 || parsedDia > 31) {
      setError('O dia de vencimento deve estar entre 1 e 31.');
      setSaving(false);
      return;
    }

    if (numBase <= 0) {
      setError('Informe o valor total da venda maior que zero.');
      setSaving(false);
      return;
    }

    const finalValorParcela = parseFloat(valorCadaParcela.toFixed(2));
    const finalValorTotal = parseFloat(totalComJuros.toFixed(2));
    const finalTaxaJuros = numJurosPct > 0 ? numJurosPct : 0;
    const finalTotalParcelas = numParcelas;
    const finalParcelaAtual = Math.min(numParcelas, Math.max(1, parseInt(parcelaAtual, 10) || 1));

    try {
      if (vendaToEdit) {
        await api.put(`/vendas/${vendaToEdit.id}`, {
          descricao,
          valor: finalValorParcela,
          dia_vencimento: parsedDia,
          valor_total: finalValorTotal,
          taxa_juros: finalTaxaJuros,
          total_parcelas: finalTotalParcelas,
          parcela_atual: finalParcelaAtual,
          ativo,
        });
      } else {
        await api.post('/vendas', {
          cliente_id: selectedClienteId,
          descricao,
          valor: finalValorParcela,
          dia_vencimento: parsedDia,
          valor_total: finalValorTotal,
          taxa_juros: finalTaxaJuros,
          total_parcelas: finalTotalParcelas,
          parcela_atual: finalParcelaAtual,
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
      <div className="modal-content" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} color="var(--primary)" />
            <h3 className="modal-title">
              {vendaToEdit ? 'Editar Cobrança / Venda' : 'Nova Cobrança / Venda'}
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
              <label className="form-label">Descrição do Produto ou Serviço *</label>
              <input
                type="text"
                className="form-input"
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: iPhone 13 128GB, Troca de Tela Moto G, Capa + Película"
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Identifica o item ou serviço na mensagem enviada no WhatsApp.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Valor Total (R$) *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  placeholder="Ex: 1000,00"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Percent size={13} /> Juros / Acréscimo (%) (Opcional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={taxaJuros}
                  onChange={(e) => setTaxaJuros(e.target.value)}
                  placeholder="Ex: 5"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: numParcelas > 1 ? '1.2fr 1fr 1fr' : '1.4fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Quantidade de Parcelas *</label>
                <select
                  className="form-select"
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(e.target.value)}
                  required
                >
                  <option value="1">1x (À vista / Pagamento único)</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48].map((n) => (
                    <option key={n} value={n}>
                      {n}x parcelas
                    </option>
                  ))}
                </select>
              </div>

              {numParcelas > 1 && (
                <div className="form-group">
                  <label className="form-label">Parcela Inicial</label>
                  <input
                    type="number"
                    min="1"
                    max={numParcelas}
                    className="form-input"
                    value={parcelaAtual}
                    onChange={(e) => setParcelaAtual(e.target.value)}
                    title="Informe se o cliente já pagou parcelas anteriores"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Dia do Vencimento *</label>
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

            {/* Box de Resumo com o Cálculo das Parcelas */}
            {numBase > 0 && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginTop: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {numParcelas === 1 ? 'Valor a pagar:' : 'Valor de cada parcela:'}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>
                    {numParcelas === 1
                      ? `R$ ${totalComJuros.toFixed(2).replace('.', ',')}`
                      : `${numParcelas}x de R$ ${valorCadaParcela.toFixed(2).replace('.', ',')}`}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span>Valor Base: R$ {numBase.toFixed(2).replace('.', ',')}</span>
                  {numJurosPct > 0 && (
                    <span style={{ color: '#fbbf24' }}>
                      Juros (+{numJurosPct}%): +R$ {valorJurosCalculado.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                  {numParcelas > 1 && (
                    <span style={{ fontWeight: 600, color: '#fff' }}>
                      Total com Juros: R$ {totalComJuros.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {vendaToEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="venda-ativo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                />
                <label htmlFor="venda-ativo" style={{ fontSize: '0.875rem', color: '#fff', cursor: 'pointer' }}>
                  Cobrança Ativa (desmarque para encerrar cobrança sem excluir o histórico)
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
