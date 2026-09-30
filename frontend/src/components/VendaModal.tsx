import React, { useState, useEffect } from 'react';
import { X, CreditCard, Save, Calculator, Percent } from 'lucide-react';
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
  const [tipoCobranca, setTipoCobranca] = useState<'parcelado' | 'recorrente'>('parcelado');
  const [descricao, setDescricao] = useState('');
  
  // Para Venda Parcelada:
  const [valorTotal, setValorTotal] = useState('');
  const [taxaJuros, setTaxaJuros] = useState('');
  const [totalParcelas, setTotalParcelas] = useState('10');
  const [parcelaAtual, setParcelaAtual] = useState('1');

  // Para Mensalidade Recorrente Contínua:
  const [valorMensal, setValorMensal] = useState('');

  const [diaVencimento, setDiaVencimento] = useState('10');
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cálculos dinâmicos em tempo real para parcelamento
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

      if (vendaToEdit.total_parcelas && vendaToEdit.total_parcelas > 1) {
        setTipoCobranca('parcelado');
        const vTot = vendaToEdit.valor_total || (vendaToEdit.valor * vendaToEdit.total_parcelas);
        setValorTotal(vTot.toFixed(2).replace('.', ','));
        setTaxaJuros(vendaToEdit.taxa_juros ? String(vendaToEdit.taxa_juros) : '');
        setTotalParcelas(String(vendaToEdit.total_parcelas));
        setParcelaAtual(String(vendaToEdit.parcela_atual || 1));
      } else {
        setTipoCobranca('recorrente');
        setValorMensal(Number(vendaToEdit.valor).toFixed(2).replace('.', ','));
      }
    } else {
      setSelectedClienteId(clienteId || (clienteList[0]?.id ?? 0));
      setTipoCobranca('parcelado');
      setDescricao('');
      setValorTotal('');
      setTaxaJuros('');
      setTotalParcelas('10');
      setParcelaAtual('1');
      setValorMensal('');
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

    let finalValorParcela = 0;
    let finalValorTotal: number | null = null;
    let finalTaxaJuros: number | null = null;
    let finalTotalParcelas: number | null = null;
    let finalParcelaAtual: number | null = 1;

    if (tipoCobranca === 'parcelado') {
      if (numBase <= 0) {
        setError('Informe o valor total da venda maior que zero.');
        setSaving(false);
        return;
      }
      finalValorParcela = parseFloat(valorCadaParcela.toFixed(2));
      finalValorTotal = parseFloat(totalComJuros.toFixed(2));
      finalTaxaJuros = numJurosPct > 0 ? numJurosPct : 0;
      finalTotalParcelas = numParcelas;
      finalParcelaAtual = Math.min(numParcelas, Math.max(1, parseInt(parcelaAtual, 10) || 1));
    } else {
      const parsedMensal = parseFloat(valorMensal.replace(/\./g, '').replace(',', '.'));
      if (isNaN(parsedMensal) || parsedMensal <= 0) {
        setError('Informe um valor mensal válido maior que zero.');
        setSaving(false);
        return;
      }
      finalValorParcela = parsedMensal;
      finalValorTotal = null;
      finalTaxaJuros = 0;
      finalTotalParcelas = null;
      finalParcelaAtual = 1;
    }

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
      <div className="modal-content" style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} color="var(--primary)" />
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

            {/* Seletor de Tipo: Parcelado vs Mensalidade */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', background: 'var(--bg-main)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: tipoCobranca === 'parcelado' ? 'var(--primary)' : 'transparent',
                  color: tipoCobranca === 'parcelado' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onClick={() => setTipoCobranca('parcelado')}
              >
                <Calculator size={15} /> Venda Parcelada / Carnê
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: tipoCobranca === 'recorrente' ? 'var(--primary)' : 'transparent',
                  color: tipoCobranca === 'recorrente' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onClick={() => setTipoCobranca('recorrente')}
              >
                🔄 Mensalidade Contínua
              </button>
            </div>

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
                placeholder="Ex: iPhone 13 128GB, Troca de Tela, Redmi Note 13"
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Identifica o item ou serviço na mensagem enviada no WhatsApp.
              </div>
            </div>

            {/* Campos Específicos para Parcelamento */}
            {tipoCobranca === 'parcelado' ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Valor Total da Venda (R$) *</label>
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
                      placeholder="Ex: 5 (aumenta 5%)"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Qtd. de Parcelas *</label>
                    <select
                      className="form-select"
                      value={totalParcelas}
                      onChange={(e) => setTotalParcelas(e.target.value)}
                      required
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48].map((n) => (
                        <option key={n} value={n}>
                          {n === 1 ? '1x (À vista / Parcela única)' : `${n}x parcelas`}
                        </option>
                      ))}
                    </select>
                  </div>

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

                  <div className="form-group">
                    <label className="form-label">Dia Venc. (1 a 31) *</label>
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

                {/* Box de Pré-visualização do Cálculo Automático */}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Valor de cada parcela:</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>
                        {numParcelas}x de R$ {valorCadaParcela.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span>Valor Base: R$ {numBase.toFixed(2).replace('.', ',')}</span>
                      {numJurosPct > 0 && (
                        <span style={{ color: '#fbbf24' }}>
                          Juros (+{numJurosPct}%): +R$ {valorJurosCalculado.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, color: '#fff' }}>
                        Total com Juros: R$ {totalComJuros.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Campos para Mensalidade Recorrente Contínua */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Valor Mensal (R$) *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={valorMensal}
                    onChange={(e) => setValorMensal(e.target.value)}
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
