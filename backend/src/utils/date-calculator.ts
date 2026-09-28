/**
 * Retorna o número de dias no mês para um determinado ano e mês (0-11)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Formata um objeto Date para YYYY-MM-DD
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte string YYYY-MM-DD em objeto Date no fuso horário local sem distorção de UTC
 */
export function parseISODate(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  return new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
}

/**
 * Calcula o vencimento inicial a partir do dia fixo (1-31) e da data de referência.
 * Se o dia já passou no mês atual, avança para o próximo mês.
 * Trata meses com menos dias ajustando para o último dia válido daquele mês.
 */
export function calculateInitialDueDate(diaVencimento: number, referenceDate: Date = new Date()): string {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const currentDay = referenceDate.getDate();

  let targetYear = currentYear;
  let targetMonth = currentMonth;

  // Se o dia do vencimento no mês corrente já passou, agenda para o próximo mês
  if (diaVencimento < currentDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  const maxDays = getDaysInMonth(targetYear, targetMonth);
  const safeDay = Math.min(diaVencimento, maxDays);

  return formatDateToISO(new Date(targetYear, targetMonth, safeDay));
}

/**
 * Calcula a próxima data de vencimento (mês seguinte) mantendo o dia fixo do cliente,
 * respeitando os limites de dias de cada mês (ex: 31 -> 28/29 em fev, 30 em abr).
 */
export function calculateNextMonthDueDate(diaVencimento: number, currentDueDateStr: string): string {
  const currentDate = parseISODate(currentDueDateStr);
  let nextYear = currentDate.getFullYear();
  let nextMonth = currentDate.getMonth() + 1;

  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }

  const maxDays = getDaysInMonth(nextYear, nextMonth);
  const safeDay = Math.min(diaVencimento, maxDays);

  return formatDateToISO(new Date(nextYear, nextMonth, safeDay));
}

/**
 * Calcula a diferença em dias entre a data alvo e a data base (alvo - base).
 * Resultado positivo significa que a data alvo está no futuro.
 * 0 significa que é hoje.
 * Negativo significa que já venceu.
 */
export function daysDifference(targetDateStr: string, baseDateStr: string = formatDateToISO(new Date())): number {
  const target = parseISODate(targetDateStr);
  const base = parseISODate(baseDateStr);

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffTime = target.getTime() - base.getTime();

  return Math.round(diffTime / msPerDay);
}
