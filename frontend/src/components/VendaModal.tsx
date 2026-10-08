import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Save, Calendar, Tag } from 'lucide-react';
import { Venda, Cliente } from '../types/index.js';
import { api } from '../services/api.js';
import { extractErrorMessage } from '../utils/error.js';

interface VendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId?: number;
  clienteList?: Cliente[];
  vendaToEdit?: Venda | null;
  onSuccess: () => void;
}

const AVAILABLE_INSTALLMENTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUICK_INSTALLMENTS = [1, 2, 3, 6, 10, 12];
const SUGGESTED_DESCRIPTIONS = ['iPhone', 'Troca de Tela', 'Xiaomi / Redmi', 'Película + Capa', 'Manutenção'];

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
  const numParcelas = Math.min(12, Math.max(1, parseInt(totalParcelas, 10) || 1));
  const valorCadaParcela = numParcelas > 0 ? (totalComJuros / numParcelas) : 0;

  useEffect(() => {
    if (vendaToEdit) {
      setSelectedClienteId(vendaToEdit.cliente_id);
      setDescricao(vendaToEdit.descricao || '');
      setDiaVencimento(String(vendaToEdit.dia_vencimento));
      setAtivo(vendaToEdit.ativo);

      const parcelas = Math.min(12, vendaToEdit.total_parcelas || 1);
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
      setError(extractErrorMessage(err, 'Erro ao salvar cobrança.'));
    } finally {
      setSaving(false);
    }
  };

  const handleApplySuggestedDesc = (item: string) => {
    setDescricao((prev) => (prev ? `${prev} - ${item}` : item));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '540px' }}>
        {/* Cabeçalho Redesenhado */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(var(--neutral-rgb), 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(var(--neutral-rgb), 0.14)',
              }}
            >
              <ShoppingBag size={18} color="var(--primary)" />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.1rem', marginBottom: '2px' }}>
                {vendaToEdit ? 'Editar Cobrança / Venda' : 'Nova Cobrança / Venda'}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Defina o item vendido, valor total e parcelamento em até 12x
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '1.25rem 1.5rem' }}>
            {error && (
              <div
                style={{
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  background: 'var(--danger-light)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(var(--danger-rgb), 0.25)',
                }}
              >
                {error}
              </div>
            )}

            {!clienteId && clienteList.length > 0 && !vendaToEdit && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
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

            {/* Descrição do Produto / Serviço */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Descrição do Produto ou Serviço *</label>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Tag size={11} /> Vai na mensagem WhatsApp
                </span>
              </div>
              <input
                type="text"
                className="form-input"
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: iPhone 13 128GB, Troca de Tela Moto G, Capa + Película"
              />
              <div className="desc-chips">
                {SUGGESTED_DESCRIPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="desc-chip"
                    onClick={() => handleApplySuggestedDesc(item)}
                    title={`Adicionar "${item}"`}
                  >
                    + {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Linha: Valor Total + Juros */}
            <div className="modal-form-row-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Valor Total da Venda *</label>
                <div className="input-with-affix">
                  <span className="input-affix input-affix-left">R$</span>
                  <input
                    type="text"
                    className="form-input form-input-left"
                    required
                    value={valorTotal}
                    onChange={(e) => setValorTotal(e.target.value)}
                    placeholder="1000,00"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Juros / Acréscimo (Opcional)</label>
                <div className="input-with-affix">
                  <input
                    type="text"
                    className="form-input form-input-right"
                    value={taxaJuros}
                    onChange={(e) => setTaxaJuros(e.target.value)}
                    placeholder="0"
                  />
                  <span className="input-affix input-affix-right">%</span>
                </div>
              </div>
            </div>

            {/* Linha: Quantidade de Parcelas (até 12x) + Dia do Vencimento */}
            <div className={numParcelas > 1 ? 'modal-form-row-3' : 'modal-form-row-2'}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Parcelamento (até 12x) *</label>
                <select
                  className="form-select"
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(e.target.value)}
                  required
                >
                  <option value="1">1x (À vista / Parcela única)</option>
                  {AVAILABLE_INSTALLMENTS.filter((n) => n > 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x parcelas
                    </option>
                  ))}
                </select>
                {/* Atalhos de parcelas mais usadas */}
                <div className="installment-pills">
                  {QUICK_INSTALLMENTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`installment-pill ${numParcelas === n ? 'active' : ''}`}
                      onClick={() => setTotalParcelas(String(n))}
                    >
                      {n === 1 ? '1x (à vista)' : `${n}x`}
                    </button>
                  ))}
                </div>
              </div>

              {numParcelas > 1 && (
                <div className="form-group" style={{ marginBottom: 0 }}>
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
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                    Padrão: 1
                  </span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={13} color="var(--primary)" /> Vencimento *
                </label>
                <div className="input-with-affix">
                  <span className="input-affix input-affix-left" style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Dia
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="form-input form-input-left"
                    required
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  Do mês
                </span>
              </div>
            </div>

            {/* CARTÃO REDESENHADO: Resumo do Parcelamento em Tempo Real */}
            {numBase > 0 ? (
              <div className="venda-resumo-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
                    {numParcelas === 1 ? 'Valor Final da Venda' : 'Valor da Parcela Mensal'}
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.02em', fontFamily: 'var(--font-heading)' }}>
                    {numParcelas === 1
                      ? `R$ ${totalComJuros.toFixed(2).replace('.', ',')}`
                      : `${numParcelas}x de R$ ${valorCadaParcela.toFixed(2).replace('.', ',')}`}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Base: </span>
                    <span>R$ {numBase.toFixed(2).replace('.', ',')}</span>
                  </div>

                  {numJurosPct > 0 && (
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Juros (+{numJurosPct}%): </span>
                      <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
                        +R$ {valorJurosCalculado.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}

                  {numParcelas > 1 && (
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Total: </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        R$ {totalComJuros.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}

                  <div style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                    Vence todo dia <b>{diaVencimento || 10}</b>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginTop: '0.75rem',
                  marginBottom: '0.5rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                }}
              >
                Preencha o valor total da venda acima para calcular as parcelas automaticamente.
              </div>
            )}

            {vendaToEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="venda-ativo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                />
                <label htmlFor="venda-ativo" style={{ fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                  Cobrança Ativa (desmarque para pausar ou encerrar a cobrança)
                </label>
              </div>
            )}
          </div>

          {/* Rodapé Redenhado */}
          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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
