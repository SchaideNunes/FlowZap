import React, { useMemo, useRef, useState } from 'react';
import { Search, UserPlus, Check } from 'lucide-react';
import { Cliente } from '../../types/index.js';
import { formatFullWhatsApp } from '../../utils/phone.js';
import { normalizeSearch } from '../../utils/format.js';

interface ClienteComboboxProps {
  id: string;
  clientes: Cliente[];
  /** Cliente escolhido (0 quando nenhum). */
  value: number;
  onChange: (clienteId: number) => void;
  /** Quem não está na lista: vira um cliente novo com o nome digitado. */
  onCreateNew: (nome: string) => void;
  invalid?: boolean;
}

const MAX_RESULTADOS = 8;

/**
 * Campo de cliente com busca: digita o nome ou parte do telefone e escolhe na lista.
 * Setas para navegar, Enter para escolher, Esc para fechar a lista.
 */
export const ClienteCombobox: React.FC<ClienteComboboxProps> = ({
  id,
  clientes,
  value,
  onChange,
  onCreateNew,
  invalid = false,
}) => {
  const escolhido = clientes.find((c) => c.id === value) || null;
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const resultados = useMemo(() => {
    const termo = normalizeSearch(texto);
    const digitos = termo.replace(/\D/g, '');
    const lista = termo
      ? clientes.filter(
          (c) => normalizeSearch(c.nome).includes(termo) || (digitos.length >= 3 && c.whatsapp.includes(digitos))
        )
      : clientes;
    return [...lista].sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, MAX_RESULTADOS);
  }, [clientes, texto]);

  const nomeDigitado = texto.trim();
  const temIgual = resultados.some((c) => normalizeSearch(c.nome) === normalizeSearch(nomeDigitado));
  const oferecerNovo = nomeDigitado.length >= 2 && /\p{L}/u.test(nomeDigitado) && !temIgual;
  const totalOpcoes = resultados.length + (oferecerNovo ? 1 : 0);
  const idLista = `${id}-opcoes`;
  const idOpcao = (i: number) => `${id}-opcao-${i}`;

  const escolher = (cliente: Cliente) => {
    onChange(cliente.id);
    setTexto('');
    setAberto(false);
  };

  const confirmarOpcao = (i: number) => {
    if (i < resultados.length) escolher(resultados[i]);
    else if (oferecerNovo) {
      setAberto(false);
      onCreateNew(nomeDigitado);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!aberto) {
        setAberto(true);
        return;
      }
      if (totalOpcoes === 0) return;
      setAtivo((i) => (e.key === 'ArrowDown' ? (i + 1) % totalOpcoes : (i - 1 + totalOpcoes) % totalOpcoes));
    } else if (e.key === 'Enter') {
      // Enter escolhe da lista em vez de enviar o formulário
      if (aberto && totalOpcoes > 0) {
        e.preventDefault();
        confirmarOpcao(Math.min(ativo, totalOpcoes - 1));
      }
    } else if (e.key === 'Escape' && aberto) {
      // Fecha só a lista, não a janela da venda
      e.preventDefault();
      e.stopPropagation();
      setAberto(false);
    }
  };

  return (
    <div className="combo">
      <div className="combo-field">
        <Search size={15} className="combo-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          className={`form-input combo-input ${invalid ? 'is-invalid' : ''}`}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={aberto && totalOpcoes > 0 ? idOpcao(Math.min(ativo, totalOpcoes - 1)) : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          placeholder={escolhido ? '' : 'Digite o nome ou o telefone do cliente'}
          value={aberto || !escolhido ? texto : `${escolhido.nome} · ${formatFullWhatsApp(escolhido.whatsapp)}`}
          onChange={(e) => {
            // Com um cliente escolhido o campo mostra o nome dele: digitar começa uma busca nova,
            // sem misturar com esse nome
            const digitado =
              !aberto && escolhido ? ((e.nativeEvent as InputEvent).data ?? '') : e.target.value;
            setTexto(digitado);
            setAtivo(0);
            setAberto(true);
            if (value) onChange(0);
          }}
          onFocus={() => {
            setAtivo(0);
            setAberto(true);
          }}
          // Clicar de novo no campo (já com foco) também reabre a lista para trocar o cliente
          onClick={() => {
            if (!aberto) {
              setTexto('');
              setAtivo(0);
              setAberto(true);
            }
          }}
          onBlur={() => setAberto(false)}
          onKeyDown={onKeyDown}
        />
        {escolhido && !aberto && <Check size={16} className="combo-ok" aria-hidden="true" />}
      </div>

      {aberto && (
        <ul className="combo-list" id={idLista} role="listbox" aria-label="Clientes">
          {resultados.map((c, i) => (
            <li
              key={c.id}
              id={idOpcao(i)}
              role="option"
              aria-selected={i === ativo}
              className={`combo-option ${i === ativo ? 'is-active' : ''}`}
              // mousedown antes do blur: a escolha acontece antes de a lista fechar
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(c);
              }}
              onMouseEnter={() => setAtivo(i)}
            >
              <span className="combo-option-name">{c.nome}</span>
              <span className="combo-option-sub">{formatFullWhatsApp(c.whatsapp)}</span>
            </li>
          ))}

          {oferecerNovo && (
            <li
              id={idOpcao(resultados.length)}
              role="option"
              aria-selected={ativo === resultados.length}
              className={`combo-option combo-option-new ${ativo === resultados.length ? 'is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                confirmarOpcao(resultados.length);
              }}
              onMouseEnter={() => setAtivo(resultados.length)}
            >
              <UserPlus size={15} aria-hidden="true" />
              <span>
                Cliente novo: <strong>{nomeDigitado}</strong>
              </span>
            </li>
          )}

          {totalOpcoes === 0 && <li className="combo-empty">Digite pelo menos duas letras do nome.</li>}
        </ul>
      )}
    </div>
  );
};
