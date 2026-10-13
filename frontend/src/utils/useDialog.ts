import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento de teclado de uma janela sobreposta: foco entra nela ao abrir, Tab circula
 * só dentro dela, Esc fecha e, ao fechar, o foco volta para onde estava.
 * O primeiro elemento com `data-autofocus` recebe o foco; sem ele, o primeiro campo.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
  canClose: boolean = true
) {
  const ref = useRef<T>(null);
  const latest = useRef({ onClose, canClose });
  latest.current = { onClose, canClose };

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) || []);

    const initial =
      node?.querySelector<HTMLElement>('[data-autofocus]') ||
      node?.querySelector<HTMLElement>('input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled)') ||
      focusables()[0];
    initial?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (latest.current.canClose) latest.current.onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !node?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !node?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  return ref;
}
