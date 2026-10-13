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

/**
 * Lê um valor em reais digitado à mão. Aceita "1.020,50", "1020,50", "1020.50" e "1020":
 * com vírgula, ela é o decimal e os pontos são milhar; sem vírgula, um ponto seguido de
 * 1 ou 2 dígitos no fim é decimal (quem digita "1020.50" quer mil e vinte e cinquenta).
 */
export function parseBRL(text: string): number {
  const clean = text.replace(/[^\d.,-]/g, '');
  if (!clean) return 0;

  let normalized: string;
  if (clean.includes(',')) {
    normalized = clean.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+\.\d{1,2}$/.test(clean)) {
    normalized = clean;
  } else {
    normalized = clean.replace(/\./g, '');
  }

  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Texto pronto para busca: minúsculas e sem acentos ("João" vira "joao").
 */
export function normalizeSearch(text: string | null | undefined): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
