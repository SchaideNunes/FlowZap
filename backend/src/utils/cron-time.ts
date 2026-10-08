export interface DailyTime {
  hour: number;
  minute: number;
}

/**
 * Extrai o horário de uma expressão cron que dispara uma vez por dia em horário fixo
 * (ex.: "0 9 * * *"). Devolve null para qualquer outro formato.
 */
export function parseDailyTime(expression: string): DailyTime | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (dayOfMonth !== '*' || month !== '*' || dayOfWeek !== '*') return null;
  if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) return null;

  const parsedMinute = Number(minute);
  const parsedHour = Number(hour);
  if (parsedMinute > 59 || parsedHour > 23) return null;

  return { hour: parsedHour, minute: parsedMinute };
}
