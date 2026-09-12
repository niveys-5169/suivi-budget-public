import { describe, it, expect } from 'vitest';
import {
  parseDateInput,
  diffInDays,
  formatMonthKey,
  getAssignedMonthKey,
} from '../../public/src/utils/date';

describe('parseDateInput', () => {
  it('returns null for null/undefined/empty', () => {
    expect(parseDateInput(null)).toBeNull();
    expect(parseDateInput(undefined)).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });

  it('returns the same Date when given a valid Date', () => {
    const d = new Date('2024-03-15');
    expect(parseDateInput(d)).toEqual(d);
  });

  it('returns null for an invalid Date object', () => {
    expect(parseDateInput(new Date('not-a-date'))).toBeNull();
  });

  it('converts a Firestore-style object with toDate()', () => {
    const firestoreTs = { toDate: () => new Date('2024-06-01') };
    const result = parseDateInput(firestoreTs);
    expect(result?.toISOString().slice(0, 10)).toBe('2024-06-01');
  });

  it('converts a Firestore-style object with seconds/nanoseconds', () => {
    const ts = { seconds: 1700000000, nanoseconds: 0 };
    const result = parseDateInput(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(1700000000 * 1000);
  });

  it('converts an ISO string', () => {
    const result = parseDateInput('2024-01-20');
    expect(result?.toISOString().slice(0, 10)).toBe('2024-01-20');
  });

  it('converts a numeric timestamp', () => {
    const ts = new Date('2024-01-01').getTime();
    const result = parseDateInput(ts);
    expect(result?.toISOString().slice(0, 10)).toBe('2024-01-01');
  });

  it('returns null for an invalid string', () => {
    expect(parseDateInput('not-a-date')).toBeNull();
  });
});

describe('diffInDays', () => {
  it('returns 0 for the same date', () => {
    const d = new Date('2024-01-01');
    expect(diffInDays(d, d)).toBe(0);
  });

  it('returns 30 for a 30-day gap', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    expect(diffInDays(start, end)).toBe(30);
  });

  it('returns negative for reversed order', () => {
    const start = new Date('2024-02-01');
    const end = new Date('2024-01-01');
    expect(diffInDays(start, end)).toBe(-31);
  });
});

describe('formatMonthKey', () => {
  it('formats a valid YYYY-MM key', () => {
    const result = formatMonthKey('2024-03', 'fr-FR');
    expect(result).toMatch(/mars/i);
    expect(result).toContain('24');
  });

  it('returns the raw key for invalid input', () => {
    expect(formatMonthKey('invalid')).toBe('invalid');
    expect(formatMonthKey('')).toBe('');
  });
});

describe('getAssignedMonthKey', () => {
  it('prioritises moisAffectation when valid', () => {
    expect(getAssignedMonthKey({ moisAffectation: '2024-05', date: '2024-06-01' })).toBe('2024-05');
  });

  it('falls back to the first 7 chars of date', () => {
    expect(getAssignedMonthKey({ date: '2024-07-15' })).toBe('2024-07');
  });

  it('returns empty string for null/undefined tx', () => {
    expect(getAssignedMonthKey({})).toBe('');
    expect(getAssignedMonthKey(null)).toBe('');
  });
});
