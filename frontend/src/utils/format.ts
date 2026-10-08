/**
 * Formata um valor em reais: 2449.3 -> "R$ 2.449,30"
 */
export function formatBRL(value: number | string | null | undefined): string {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Data de hoje como "YYYY-MM-DD" no fuso do navegador. Não usar toISOString() para isso:
 * ele devolve a data em UTC, que no Brasil já é "amanhã" depois das 21h.
 */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formata uma data "YYYY-MM-DD" (ou ISO completa) como "DD/MM/AAAA", sem conversão de fuso.
 */
export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('T')[0].split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}
