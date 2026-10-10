import React, { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { ConfiguracaoData, TipoAviso } from '../types/index.js';
import { api } from '../services/api.js';
import { extractErrorMessage } from '../utils/error.js';

interface MensagensEditorProps {
  config: ConfiguracaoData;
  onSaved: (config: ConfiguracaoData) => void;
}

const AVISOS: { tipo: TipoAviso; titulo: string; quando: string }[] = [
  { tipo: 'lembrete_3d', titulo: 'Lembrete de 3 dias', quando: 'Enviado 3 dias antes do vencimento' },
  { tipo: 'lembrete_2d', titulo: 'Lembrete de 2 dias', quando: 'Enviado 2 dias antes do vencimento' },
  { tipo: 'lembrete_1d', titulo: 'Lembrete da véspera', quando: 'Enviado 1 dia antes do vencimento' },
  { tipo: 'vencido', titulo: 'Aviso de vencimento', quando: 'Enviado no dia do vencimento, uma única vez' },
];

// Cliente fictício, só para mostrar como a mensagem chega
const EXEMPLO_PIX = 'sua-chave-pix';
const EXEMPLO: Record<string, string> = {
  '{saudacao}': 'Olá',
  '{nome}': 'Maria',
  '{produto}': 'iPhone 13 (Parcela 2 de 10)',
  '{valor}': '150,00',
  '{vencimento}': '15/10/2026',
  '{referencia}': ' referente a *iPhone 13 (Parcela 2 de 10)*',
};

const VARIAVEL = /\{[^{}\s]*\}/g;
const MIN_CARACTERES = 10;
const MAX_CARACTERES = 1000;

// O WhatsApp mostra *texto* em negrito
const renderWhatsApp = (texto: string) =>
  texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
    parte.length > 2 && parte.startsWith('*') && parte.endsWith('*') ? (
      <strong key={i}>{parte.slice(1, -1)}</strong>
    ) : (
      <React.Fragment key={i}>{parte}</React.Fragment>
    )
  );

export const MensagensEditor: React.FC<MensagensEditorProps> = ({ config, onSaved }) => {
  const textoEmVigor = (tipo: TipoAviso) => config.mensagens[tipo] || config.padroes[tipo];

  const [textos, setTextos] = useState<Record<TipoAviso, string>>(() => ({
    lembrete_3d: textoEmVigor('lembrete_3d'),
    lembrete_2d: textoEmVigor('lembrete_2d'),
    lembrete_1d: textoEmVigor('lembrete_1d'),
    vencido: textoEmVigor('vencido'),
  }));
  const [salvando, setSalvando] = useState<TipoAviso | null>(null);
  const [salvo, setSalvo] = useState<TipoAviso | null>(null);
  const [erros, setErros] = useState<Partial<Record<TipoAviso, string>>>({});
  const campos = useRef<Partial<Record<TipoAviso, HTMLTextAreaElement | null>>>({});

  const [pix, setPix] = useState(config.chave_pix || '');
  const [pixEstado, setPixEstado] = useState<'parado' | 'salvando' | 'salvo'>('parado');
  const [pixErro, setPixErro] = useState<string | null>(null);
  const pixAlterado = pix.trim() !== (config.chave_pix || '');

  const salvarPix = async () => {
    setPixEstado('salvando');
    setPixErro(null);
    try {
      const res = await api.put('/configuracoes', { chave_pix: pix.trim() || null });
      const nova: ConfiguracaoData = res.data;
      onSaved(nova);
      setPix(nova.chave_pix || '');
      setPixEstado('salvo');
      setTimeout(() => setPixEstado('parado'), 3000);
    } catch (err: unknown) {
      setPixErro(extractErrorMessage(err, 'Não foi possível salvar a chave Pix.'));
      setPixEstado('parado');
    }
  };

  useEffect(() => {
    if (!salvo) return;
    const timer = setTimeout(() => setSalvo(null), 3000);
    return () => clearTimeout(timer);
  }, [salvo]);

  const conhecidas = new Set(config.variaveis.map((v) => v.chave));

  const alterar = (tipo: TipoAviso, texto: string) => {
    setTextos((prev) => ({ ...prev, [tipo]: texto }));
    setErros((prev) => ({ ...prev, [tipo]: undefined }));
  };

  const inserirVariavel = (tipo: TipoAviso, chave: string) => {
    const campo = campos.current[tipo];
    const atual = textos[tipo];
    const inicio = campo?.selectionStart ?? atual.length;
    const fim = campo?.selectionEnd ?? atual.length;
    alterar(tipo, atual.slice(0, inicio) + chave + atual.slice(fim));
    requestAnimationFrame(() => {
      campo?.focus();
      campo?.setSelectionRange(inicio + chave.length, inicio + chave.length);
    });
  };

  const salvar = async (tipo: TipoAviso, texto: string | null) => {
    setSalvando(tipo);
    try {
      const res = await api.put('/configuracoes', { mensagens: { [tipo]: texto } });
      const nova: ConfiguracaoData = res.data;
      onSaved(nova);
      setTextos((prev) => ({ ...prev, [tipo]: nova.mensagens[tipo] || nova.padroes[tipo] }));
      setSalvo(tipo);
    } catch (err: unknown) {
      setErros((prev) => ({ ...prev, [tipo]: extractErrorMessage(err, 'Não foi possível salvar a mensagem.') }));
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="template-grid">
      <section className="template-card template-card-wide">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Chave Pix</h3>
            <div className="panel-caption">
              Entra nas mensagens onde você colocar {'{pix}'}. Para o cliente copiar fácil, deixe a chave sozinha em
              uma linha.
            </div>
          </div>
          <span className={`badge ${config.chave_pix ? 'badge-pago' : ''}`}>
            {config.chave_pix ? 'Cadastrada' : 'Não cadastrada'}
          </span>
        </div>

        <div className="pix-row">
          <input
            type="text"
            className="form-input"
            aria-label="Chave Pix"
            placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatória"
            maxLength={140}
            value={pix}
            onChange={(e) => {
              setPix(e.target.value);
              setPixErro(null);
            }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!pixAlterado || pixEstado === 'salvando'}
            onClick={salvarPix}
          >
            <Check size={14} />
            {pixEstado === 'salvando' ? 'Salvando...' : pixEstado === 'salvo' ? 'Salvo' : 'Salvar chave'}
          </button>
        </div>

        {pixErro && (
          <div className="form-hint is-danger" role="alert">
            {pixErro}
          </div>
        )}
      </section>

      {AVISOS.map(({ tipo, titulo, quando }) => {
        const texto = textos[tipo];
        const limpo = texto.trim();
        const padrao = config.padroes[tipo];
        const personalizada = Boolean(config.mensagens[tipo]);
        const alterado = limpo !== textoEmVigor(tipo);
        const desconhecidas = [...new Set((texto.match(VARIAVEL) || []).filter((v) => !conhecidas.has(v)))];

        const problema =
          limpo.length < MIN_CARACTERES
            ? `Escreva pelo menos ${MIN_CARACTERES} caracteres.`
            : limpo.length > MAX_CARACTERES
              ? `A mensagem pode ter no máximo ${MAX_CARACTERES} caracteres.`
              : desconhecidas.length > 0
                ? `Variável que não existe: ${desconhecidas.join(', ')}`
                : !texto.includes('{saudacao}')
                  ? 'A mensagem precisa ter {saudacao}. A saudação variada protege o número contra bloqueio.'
                  : null;

        const previa = limpo.replace(VARIAVEL, (v) =>
          v === '{pix}' ? config.chave_pix || EXEMPLO_PIX : (EXEMPLO[v] ?? v)
        );
        const pixSemChave = texto.includes('{pix}') && !config.chave_pix;
        const idCampo = `mensagem-${tipo}`;

        return (
          <section key={tipo} className="template-card">
            <div className="panel-head">
              <div>
                <h3 className="panel-title">{titulo}</h3>
                <div className="panel-caption">{quando}</div>
              </div>
              <span className={`badge ${personalizada ? 'badge-avisado' : ''}`}>
                {personalizada ? 'Personalizada' : 'Padrão'}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={idCampo}>
                Texto da mensagem
              </label>
              <textarea
                id={idCampo}
                ref={(el) => {
                  campos.current[tipo] = el;
                }}
                className="form-textarea"
                rows={5}
                maxLength={MAX_CARACTERES}
                value={texto}
                onChange={(e) => alterar(tipo, e.target.value)}
              />

              <div className="var-chips" aria-label="Inserir variável">
                {config.variaveis.map((v) => (
                  <button
                    key={v.chave}
                    type="button"
                    className="var-chip"
                    title={v.descricao}
                    onClick={() => inserirVariavel(tipo, v.chave)}
                  >
                    {v.chave}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="form-label">Como o cliente recebe</div>
              <div className="wa-preview">{renderWhatsApp(previa)}</div>
            </div>

            {problema && alterado && (
              <div className="form-hint is-danger" role="alert">
                {problema}
              </div>
            )}
            {pixSemChave && (
              <div className="form-hint is-warning">
                Esta mensagem usa {'{pix}'}, mas a chave Pix ainda não foi cadastrada. Sem ela, esse trecho sai vazio.
              </div>
            )}
            {erros[tipo] && (
              <div className="form-hint is-danger" role="alert">
                {erros[tipo]}
              </div>
            )}

            <div className="panel-foot">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!alterado || Boolean(problema) || salvando === tipo}
                onClick={() => salvar(tipo, limpo === padrao ? null : limpo)}
              >
                <Check size={14} />
                {salvando === tipo ? 'Salvando...' : salvo === tipo ? 'Salvo' : 'Salvar mensagem'}
              </button>

              {(personalizada || alterado) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={salvando === tipo}
                  onClick={() => (personalizada ? salvar(tipo, null) : alterar(tipo, padrao))}
                >
                  <RotateCcw size={14} />
                  Voltar para a padrão
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};
