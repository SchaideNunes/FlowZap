import React, { useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastData {
  /** Muda a cada aviso, para reiniciar o tempo mesmo com o mesmo texto. */
  id: number;
  /** info: aviso neutro, sem cor de status (ex.: "nada para enviar hoje"). */
  tone: 'success' | 'danger' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

const DURATION_MS = 9000;

/**
 * Aviso fixo na base da tela: fica visível onde quer que a pessoa esteja na lista e pode
 * trazer uma ação imediata (ex.: "Desfazer"). O tempo pausa com o mouse ou o foco em cima.
 */
export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = () => {
    stop();
    timer.current = setTimeout(() => close.current(), DURATION_MS);
  };

  useEffect(() => {
    if (!toast) return;
    start();
    return stop;
  }, [toast?.id]);

  return (
    // A região existe sempre, para o leitor de tela anunciar o aviso quando ele entra
    <div className="toast-region" aria-live={toast?.tone === 'danger' ? 'assertive' : 'polite'} aria-atomic="true">
      {toast && (
        <div
          className={`toast toast-${toast.tone}`}
          onMouseEnter={stop}
          onMouseLeave={start}
          onFocus={stop}
          onBlur={start}
        >
          {toast.tone === 'success' ? (
            <CheckCircle2 size={18} aria-hidden="true" />
          ) : toast.tone === 'info' ? (
            <Info size={18} aria-hidden="true" />
          ) : (
            <AlertTriangle size={18} aria-hidden="true" />
          )}
          <span className="toast-message">{toast.message}</span>
          {toast.actionLabel && toast.onAction && (
            <button type="button" className="btn btn-secondary btn-sm toast-action" onClick={toast.onAction}>
              {toast.actionLabel}
            </button>
          )}
          <button type="button" className="toast-close" onClick={onClose} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
