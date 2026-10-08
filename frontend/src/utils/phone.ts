/**
 * Utilitários para formatação e máscara de números de telefone e WhatsApp brasileiro (+55)
 */

/**
 * Remove caracteres não numéricos e remove o DDI 55 caso venha incluído
 */
export function extractPhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  // Se já tiver mais de 11 dígitos e começar com 55 (ex: 5511912345678), remove o 55 do início
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  // Limita ao máximo de 11 dígitos (DDD 2 dígitos + 9 dígitos de telefone)
  return digits.slice(0, 11);
}

/**
 * Aplica máscara brasileira (XX) XXXXX-XXXX ou (XX) XXXX-XXXX para até 11 dígitos
 */
export function maskPhone(value: string): { display: string; digits: string } {
  const digits = extractPhoneDigits(value);

  if (digits.length === 0) {
    return { display: '', digits: '' };
  }

  if (digits.length <= 2) {
    return { display: `(${digits}`, digits };
  }

  if (digits.length <= 6) {
    return { display: `(${digits.slice(0, 2)}) ${digits.slice(2)}`, digits };
  }

  if (digits.length <= 10) {
    return {
      display: `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`,
      digits,
    };
  }

  return {
    display: `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`,
    digits,
  };
}

/**
 * Formata um número completo salvo no banco (ex: 5511912345678) para exibição legível:
 * "+55 (11) 91234-5678"
 */
export function formatFullWhatsApp(rawNumber: string): string {
  if (!rawNumber) return '-';
  const clean = rawNumber.replace(/\D/g, '');

  if (clean.length === 13 && clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const part1 = clean.slice(4, 9);
    const part2 = clean.slice(9, 13);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  if (clean.length === 12 && clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const part1 = clean.slice(4, 8);
    const part2 = clean.slice(8, 12);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  if (clean.length === 11) {
    const ddd = clean.slice(0, 2);
    const part1 = clean.slice(2, 7);
    const part2 = clean.slice(7, 11);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  if (clean.length === 10) {
    const ddd = clean.slice(0, 2);
    const part1 = clean.slice(2, 6);
    const part2 = clean.slice(6, 10);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  return rawNumber;
}
