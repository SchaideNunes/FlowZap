import { describe, it, expect } from 'vitest';
import { parseDailyTime } from './cron-time.js';

describe('parseDailyTime', () => {
  it('extrai hora e minuto de uma rotina diária simples', () => {
    expect(parseDailyTime('0 9 * * *')).toEqual({ hour: 9, minute: 0 });
    expect(parseDailyTime('30 8 * * *')).toEqual({ hour: 8, minute: 30 });
    expect(parseDailyTime('  15 17 * * *  ')).toEqual({ hour: 17, minute: 15 });
  });

  it('devolve null quando a expressão não é um horário fixo diário', () => {
    expect(parseDailyTime('*/5 * * * *')).toBeNull();
    expect(parseDailyTime('0 9,15 * * *')).toBeNull();
    expect(parseDailyTime('0 9 * * 1-5')).toBeNull();
    expect(parseDailyTime('0 9 1 * *')).toBeNull();
    expect(parseDailyTime('0 9 * *')).toBeNull();
    expect(parseDailyTime('0 25 * * *')).toBeNull();
    expect(parseDailyTime('')).toBeNull();
  });
});
