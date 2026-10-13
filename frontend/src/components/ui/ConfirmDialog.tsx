import React from 'react';
import { X } from 'lucide-react';
import { useDialog } from '../../utils/useDialog.js';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** O que está sendo confirmado: quem, o quê, quanto. */
  children: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  /** Classe do botão que confirma (.btn-pay para pagamento, .btn-danger para ação destrutiva). */
  confirmClassName?: string;
  confirmIcon?: React.ReactNode;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação do próprio sistema, no lugar das caixas do navegador: mostra os dados do que
 * está sendo confirmado, fecha com Esc e devolve o foco a quem abriu.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  children,
  confirmLabel,
  busyLabel = 'Salvando...',
  confirmClassName = 'btn-primary',
  confirmIcon,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const ref = useDialog(open, onCancel, !busy);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={ref}
        className="modal-content modal-content-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-titulo"
        aria-describedby="confirm-corpo"
      >
        <div className="modal-header">
          <h3 className="modal-title" id="confirm-titulo">
            {title}
          </h3>
          <button type="button" className="modal-close" onClick={onCancel} disabled={busy} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body confirm-body" id="confirm-corpo">
          {children}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={`btn ${confirmClassName}`} onClick={onConfirm} disabled={busy} data-autofocus>
            {confirmIcon}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
