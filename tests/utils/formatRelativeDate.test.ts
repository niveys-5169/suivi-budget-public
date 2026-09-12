import { describe, it, expect } from 'vitest';
import { formatRelativeDate } from '../../public/src/utils/formatRelativeDate';

describe('formatRelativeDate', () => {
  it('should format today, yesterday, and relative days correctly', () => {
    const now = new Date();

    // Today
    expect(formatRelativeDate(now)).toBe("Aujourd'hui");

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    expect(formatRelativeDate(yesterday)).toBe('Hier');

    // N days ago (e.g. 3 days ago)
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(now.getDate() - 3);
    expect(formatRelativeDate(threeDaysAgo)).toBe('Il y a 3 j');

    // N days ago (e.g. 7 days ago)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    expect(formatRelativeDate(sevenDaysAgo)).toBe('Il y a 7 j');

    // Older date (e.g. 8 days ago)
    const eightDaysAgo = new Date(now);
    eightDaysAgo.setDate(now.getDate() - 8);
    const day = String(eightDaysAgo.getDate()).padStart(2, '0');
    const month = String(eightDaysAgo.getMonth() + 1).padStart(2, '0');
    const year = eightDaysAgo.getFullYear();
    expect(formatRelativeDate(eightDaysAgo)).toBe(`${day}/${month}/${year}`);
  });

  it('should return empty string for null or undefined values', () => {
    expect(formatRelativeDate(null)).toBe('');
    expect(formatRelativeDate(undefined)).toBe('');
  });
});
