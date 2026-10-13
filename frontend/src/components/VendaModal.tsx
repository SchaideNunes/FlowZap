import React, { useState, useEffect } from 'react';
import { X, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Venda, Cliente } from '../types/index.js';
import { api } from '../services/api.js';
import { extractErrorMessage } from '../utils/error.js';
import { formatBRL } from '../utils/format.js';
import { formatFullWhatsApp, maskPhone } from '../utils/phone.js';

interface VendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId?: number;
  clienteList?: Cliente[];
  vendaToEdit?: Venda | null;
  onSuccess: () => void;
}

const MAX_PARCELAS = 12;
const PARCELAS = Array.from({ length: MAX_PARCELAS }, (_, i) => i + 1);

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
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  // Cliente novo, digitado na própria venda
  const [clienteNovo, setClienteNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [cadastrar, setCadastrar] = useState(true);
  const [novoFone, setNovoFone] = useState({ display: '', digits: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cálculos dinâmicos em tempo real
  const numBase = parseFloat(valorTotal.replace(/\./g, '').replace(',', '.')) || 0;
  const numJurosPct = parseFloat(taxaJuros.replace(',', '.')) || 0;
  const totalComJuros = numBase + numBase * (numJurosPct / 100);
  const numParcelas = Math.min(MAX_PARCELAS, Math.max(1, parseInt(totalParcelas, 10) || 1));
  const valorCadaParcela = totalComJuros / numParcelas;

  useEffect(() => {
    if (vendaToEdit) {
      setSelectedClienteId(vendaToEdit.cliente_id ?? 0);
      setDescricao(vendaToEdit.descricao || '');
      setDiaVencimento(String(vendaToEdit.dia_vencimento));
      setAtivo(vendaToEdit.ativo);

      const parcelas = Math.min(MAX_PARCELAS, vendaToEdit.total_parcelas || 1);
      const parcelaInicial = vendaToEdit.parcela_atual || 1;
      setTotalParcelas(String(parcelas));
      setParcelaAtual(String(parcelaInicial));
      setTaxaJuros(vendaToEdit.taxa_juros ? String(vendaToEdit.taxa_juros) : '');

      const vTot = vendaToEdit.valor_total || vendaToEdit.valor * parcelas;
      setValorTotal(vTot.toFixed(2).replace('.', ','));
      // Quem já usa juros ou parcela inicial vê esses campos sem precisar procurar
      setMaisOpcoes(Boolean(vendaToEdit.taxa_juros) || parcelaInicial > 1);
    } else {
      setSelectedClienteId(clienteId || (clienteList[0]?.id ?? 0));
      setDescricao('');
      setValorTotal('');
      setTaxaJuros('');
      setTotalParcelas('1');
      setParcelaAtual('1');
      setDiaVencimento('10');
      setAtivo(true);
      setMaisOpcoes(false);
    }
    // Sem nenhum cliente cadastrado, a venda já começa pedindo o nome
    setClienteNovo(!vendaToEdit && !clienteId && clienteList.length === 0);
    setNovoNome('');
    setCadastrar(true);
    setNovoFone({ display: '', digits: '' });
    setError(null);
  }, [vendaToEdit, clienteId, clienteList, isOpen]);

  if (!isOpen) return null;

  const escolheCliente = !clienteId && !vendaToEdit;

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

    const usarClienteNovo = escolheCliente && clienteNovo;
    if (usarClienteNovo && novoNome.trim().length < 2) {
      setError('Informe o nome do cliente.');
      setSaving(false);
      return;
    }
    if (usarClienteNovo && cadastrar && novoFone.digits.length < 10) {
      setError('Informe o DDD e o número completo do WhatsApp, ou desmarque "Cadastrar este cliente".');
      setSaving(false);
      return;
    }

    const payload = {
      descricao,
      valor: parseFloat(valorCadaParcela.toFixed(2)),
      dia_vencimento: parsedDia,
      valor_total: parseFloat(totalComJuros.toFixed(2)),
      taxa_juros: numJurosPct > 0 ? numJurosPct : 0,
      total_parcelas: numParcelas,
      parcela_atual: Math.min(numParcelas, Math.max(1, parseInt(parcelaAtual, 10) || 1)),
      ativo,
    };

    try {
      if (vendaToEdit) {
        await api.put(`/vendas/${vendaToEdit.id}`, payload);
      } else if (!usarClienteNovo) {
        await api.post('/vendas', { cliente_id: selectedClienteId, ...payload });
      } else if (cadastrar) {
        // Cadastra o cliente e já faz a venda no nome dele
        const criado = await api.post('/clientes', {
          nome: novoNome.trim(),
          whatsapp: '55' + novoFone.digits,
          observacoes: null,
          ativo: true,
        });
        await api.post('/vendas', { cliente_id: criado.data.id, ...payload });
      } else {
        await api.post('/vendas', { cliente_avulso: novoNome.trim(), ...payload });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Erro ao salvar a venda.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="venda-titulo">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 className="modal-title" id="venda-titulo">
            {vendaToEdit ? 'Editar venda' : 'Nova venda'}
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

            {escolheCliente && clienteList.length > 0 && (
              <div className="excel-filters segmented" role="group" aria-label="Cliente da venda">
                <button
                  type="button"
                  className={`excel-filter-btn ${!clienteNovo ? 'active' : ''}`}
                  onClick={() => setClienteNovo(false)}
                  aria-pressed={!clienteNovo}
                >
                  Cliente cadastrado
                </button>
                <button
                  type="button"
                  className={`excel-filter-btn ${clienteNovo ? 'active' : ''}`}
                  onClick={() => setClienteNovo(true)}
                  aria-pressed={clienteNovo}
                >
                  Cliente novo
                </button>
              </div>
            )}

            {escolheCliente && clienteNovo && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="venda-cliente-nome">
                    Nome do cliente
                  </label>
                  <input
                    id="venda-cliente-nome"
                    type="text"
                    className="form-input"
                    required
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome de quem comprou"
                    autoComplete="off"
                  />
                </div>

                <label className="venda-ativa">
                  <input type="checkbox" checked={cadastrar} onChange={(e) => setCadastrar(e.target.checked)} />
                  <span>Cadastrar este cliente</span>
                </label>

                {cadastrar ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="venda-cliente-whatsapp">
                      WhatsApp
                    </label>
                    <div className="input-phone-group">
                      <span className="input-phone-prefix">+55</span>
                      <input
                        id="venda-cliente-whatsapp"
                        type="tel"
                        inputMode="numeric"
                        className="form-input"
                        value={novoFone.display}
                        onChange={(e) => setNovoFone(maskPhone(e.target.value))}
                        placeholder="(11) 91234-5678"
                        maxLength={15}
                        autoComplete="off"
                      />
                    </div>
                    <span className="form-hint">É para este número que os avisos de cobrança são enviados.</span>
                  </div>
                ) : (
                  <span className="form-hint is-warning">
                    Sem cadastro, este cliente não recebe avisos pelo WhatsApp. Você pode cadastrá-lo depois, na lista de
                    vendas.
                  </span>
                )}
              </>
            )}

            {escolheCliente && !clienteNovo && clienteList.length > 0 && (
              <div className="form-group">
                <label className="form-label" htmlFor="venda-cliente">
                  Cliente
                </label>
                <select
                  id="venda-cliente"
                  className="form-select"
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(Number(e.target.value))}
                  required
                >
                  {clienteList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} · {formatFullWhatsApp(c.whatsapp)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="venda-descricao">
                O que foi vendido
              </label>
              <input
                id="venda-descricao"
                type="text"
                className="form-input"
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: iPhone 13 128GB"
              />
              <span className="form-hint">Este nome aparece na mensagem enviada ao cliente.</span>
            </div>

            <div className="modal-form-row-3">
              <div className="form-group">
                <label className="form-label" htmlFor="venda-valor">
                  Valor total
                </label>
                <div className="input-with-affix">
                  <span className="input-affix input-affix-left">R$</span>
                  <input
                    id="venda-valor"
                    type="text"
                    inputMode="decimal"
                    className="form-input form-input-left"
                    required
                    value={valorTotal}
                    onChange={(e) => setValorTotal(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="venda-parcelas">
                  Parcelas
                </label>
                <select
                  id="venda-parcelas"
                  className="form-select"
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(e.target.value)}
                  required
                >
                  {PARCELAS.map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? 'À vista' : `${n}x`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="venda-dia">
                  Dia do vencimento
                </label>
                <input
                  id="venda-dia"
                  type="number"
                  min="1"
                  max="31"
                  className="form-input"
                  required
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value)}
                />
              </div>
            </div>

            {numBase > 0 && (
              <div className="venda-resumo" aria-live="polite">
                <span className="venda-resumo-valor">
                  {numParcelas > 1 ? `${numParcelas}x de ${formatBRL(valorCadaParcela)}` : formatBRL(totalComJuros)}
                </span>
                <span className="venda-resumo-detalhe">
                  {[
                    numParcelas > 1 || numJurosPct > 0 ? `Total ${formatBRL(totalComJuros)}` : null,
                    numJurosPct > 0 ? `com ${numJurosPct}% de juros` : null,
                    `vence todo dia ${diaVencimento || '-'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            )}

            <button
              type="button"
              className="link-btn more-toggle"
              onClick={() => setMaisOpcoes((aberto) => !aberto)}
              aria-expanded={maisOpcoes}
            >
              {maisOpcoes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Juros e parcela inicial
            </button>

            {maisOpcoes && (
              <div className="modal-form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="venda-juros">
                    Juros sobre o total
                  </label>
                  <div className="input-with-affix">
                    <input
                      id="venda-juros"
                      type="text"
                      inputMode="decimal"
                      className="form-input form-input-right"
                      value={taxaJuros}
                      onChange={(e) => setTaxaJuros(e.target.value)}
                      placeholder="0"
                    />
                    <span className="input-affix input-affix-right">%</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="venda-parcela-inicial">
                    Começar na parcela
                  </label>
                  <input
                    id="venda-parcela-inicial"
                    type="number"
                    min="1"
                    max={numParcelas}
                    className="form-input"
                    value={parcelaAtual}
                    onChange={(e) => setParcelaAtual(e.target.value)}
                    disabled={numParcelas === 1}
                  />
                  <span className="form-hint">Use se o cliente já pagou parcelas antes.</span>
                </div>
              </div>
            )}

            {vendaToEdit && (
              <label className="venda-ativa">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                <span>Cobrança ativa (desmarque para pausar os avisos)</span>
              </label>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar venda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
