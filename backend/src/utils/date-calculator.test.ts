import { describe, it, expect } from 'vitest';
import {
  calculateInitialDueDate,
  calculateNextMonthDueDate,
  formatDateToISO,
  daysDifference,
} from './date-calculator.js';

describe('DateCalculator (TDD)', () => {
  describe('calculateInitialDueDate', () => {
    it('should set due date to current month if due day is in the future', () => {
      // Reference date: 2026-09-05, due day: 15
      const referenceDate = new Date(2026, 8, 5); // September 5, 2026
      const dueDate = calculateInitialDueDate(15, referenceDate);
      expect(dueDate).toBe('2026-09-15');
    });

    it('should set due date to current month if due day is today', () => {
      const referenceDate = new Date(2026, 8, 15); // September 15, 2026
      const dueDate = calculateInitialDueDate(15, referenceDate);
      expect(dueDate).toBe('2026-09-15');
    });

    it('should set due date to next month if due day in current month has already passed', () => {
      // Reference date: 2026-09-20, due day: 10
      const referenceDate = new Date(2026, 8, 20); // September 20, 2026
      const dueDate = calculateInitialDueDate(10, referenceDate);
      expect(dueDate).toBe('2026-10-10');
    });

    it('should adjust day 31 to last day of month when month has 30 days (e.g., September)', () => {
      const referenceDate = new Date(2026, 8, 5); // September 5, 2026
      const dueDate = calculateInitialDueDate(31, referenceDate);
      expect(dueDate).toBe('2026-09-30');
    });

    it('should adjust day 31 to 28 in February (non-leap year)', () => {
      const referenceDate = new Date(2026, 1, 5); // February 5, 2026
      const dueDate = calculateInitialDueDate(31, referenceDate);
      expect(dueDate).toBe('2026-02-28');
    });
  });

  describe('calculateNextMonthDueDate', () => {
    it('should advance to the same day in the next month', () => {
      const nextDue = calculateNextMonthDueDate(10, '2026-09-10');
      expect(nextDue).toBe('2026-10-10');
    });

    it('should advance from December to January of next year', () => {
      const nextDue = calculateNextMonthDueDate(15, '2026-12-15');
      expect(nextDue).toBe('2027-01-15');
    });

    it('should cap at 28 for February when moving from January 31', () => {
      const nextDue = calculateNextMonthDueDate(31, '2026-01-31');
      expect(nextDue).toBe('2026-02-28');
    });

    it('should cap at 30 for April when moving from March 31', () => {
      const nextDue = calculateNextMonthDueDate(31, '2026-03-31');
      expect(nextDue).toBe('2026-04-30');
    });
  });

  describe('daysDifference', () => {
    it('should return 0 when target date is today', () => {
      const today = '2026-09-15';
      const target = '2026-09-15';
      expect(daysDifference(target, today)).toBe(0);
    });

    it('should return positive number when target date is in the future', () => {
      const today = '2026-09-15';
      const target = '2026-09-18';
      expect(daysDifference(target, today)).toBe(3);
    });

    it('should return negative number when target date is in the past', () => {
      const today = '2026-09-15';
      const target = '2026-09-10';
      expect(daysDifference(target, today)).toBe(-5);
    });
  });
});
