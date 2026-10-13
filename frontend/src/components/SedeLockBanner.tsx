import React, { useState } from 'react';
import { AlertTriangle, MonitorCheck } from 'lucide-react';
import { SedeLockInfo } from '../types/index.js';
import { api } from '../services/api.js';
import { extractErrorMessage } from '../utils/error.js';
import { formatDateBR, todayISO } from '../utils/format.js';
import { ConfirmDialog } from './ui/ConfirmDialog.js';

interface SedeLockBannerProps {
  trava: SedeLockInfo;
  /** Chamado depois que este computador passa a ser a sede. */
  onChanged: () => void;
}

const quando = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dia = todayISO(d);
  return dia === todayISO() ? `hoje às ${hora}` : `${formatDateBR(dia)} às ${hora}`;
};

/**
 * Aviso para o computador que tem o sistema instalado mas não é a sede: ele não envia
 * cobranças. Dá a opção de assumir a sede, que é uma decisão de quem está na frente dele.
 */
export const SedeLockBanner: React.FC<SedeLockBannerProps> = ({ trava, onChanged }) => {
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nome = trava.sedeNome ? `o computador “${trava.sedeNome}”` : 'outro computador';
  const vista = quando(trava.sedeVistaEm);

  const assumir = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await api.post('/cobrancas/assumir-sede');
      setConfirmando(false);
      onChanged();
    } catch (err: unknown) {
      setConfirmando(false);
      setErro(extractErrorMessage(err, 'Não foi possível tornar este computador a sede.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="alert alert-warning" role="status">
        <AlertTriangle size={18} aria-hidden="true" />
        <span>
          <strong>Este computador não está enviando cobranças.</strong> A sede é {nome}
          {vista ? `, vista pela última vez ${vista}` : ''}. Aqui você pode consultar e cadastrar normalmente.
          {erro && <span className="form-hint is-danger"> {erro}</span>}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmando(true)}>
          <MonitorCheck size={14} />
          Usar este computador como sede
        </button>
      </div>

      <ConfirmDialog
        open={confirmando}
        title="Usar este computador como sede"
        confirmLabel="Tornar este a sede"
        busyLabel="Trocando..."
        busy={salvando}
        onConfirm={assumir}
        onCancel={() => setConfirmando(false)}
      >
        <div className="confirm-what">
          As cobranças passam a sair por este computador, pelo WhatsApp conectado aqui. Em até um minuto, {nome} para
          de enviar.
        </div>
        <div className="confirm-note">
          Faça isso só se este for o computador que fica ligado na loja. Se o WhatsApp da loja não estiver conectado
          aqui, leia o QR Code em seguida.
        </div>
      </ConfirmDialog>
    </>
  );
};
