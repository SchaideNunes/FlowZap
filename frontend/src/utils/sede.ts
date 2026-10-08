import { WhatsAppStatus } from '../types/index.js';

export type SedeTone = 'ok' | 'warn' | 'off' | 'unknown';

export interface SedeSummary {
  tone: SedeTone;
  label: string;
  short: string;
  detail: string;
}

/**
 * "há 3 min", "há 2 h", "há 4 dias"
 */
export function formatLastSeen(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'nunca';
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

/**
 * Resume a situação da máquina-sede para o painel online (que não envia mensagens).
 */
export function summarizeSede(info: WhatsAppStatus): SedeSummary {
  const sede = info.sede;

  if (!sede) {
    return {
      tone: 'unknown',
      label: 'Sede sem informação',
      short: 'Sem sinal',
      detail: 'O painel online ainda não recebeu informações da máquina-sede.',
    };
  }

  if (!sede.online) {
    return {
      tone: 'off',
      label: 'Sede offline',
      short: 'Offline',
      detail: `Último sinal ${formatLastSeen(sede.lastSeen)}. Os envios só saem com o computador da loja ligado e com internet.`,
    };
  }

  if (info.state === 'open') {
    return {
      tone: 'ok',
      label: 'Sede online',
      short: 'Online',
      detail: 'WhatsApp conectado. Os envios saem normalmente pelo computador da loja.',
    };
  }

  if (info.state === 'connecting') {
    return {
      tone: 'warn',
      label: 'Sede online · conectando',
      short: 'Conectando',
      detail: 'A sede está reconectando o WhatsApp. Os envios retomam sozinhos.',
    };
  }

  return {
    tone: 'warn',
    label: 'Sede online · WhatsApp desconectado',
    short: 'WhatsApp off',
    detail: 'Abra o sistema no computador da loja e leia o QR Code para conectar o WhatsApp.',
  };
}

export const SEDE_BADGE_CLASS: Record<SedeTone, string> = {
  ok: 'badge-pago',
  warn: 'badge-avisado',
  off: 'badge-vencido',
  unknown: 'badge-pendente',
};

export const SEDE_DOT_CLASS: Record<SedeTone, string> = {
  ok: 'online',
  warn: 'connecting',
  off: 'offline',
  unknown: 'offline',
};
