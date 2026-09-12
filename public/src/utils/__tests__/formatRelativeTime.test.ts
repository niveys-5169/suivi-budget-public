import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../firestoreDate';

const NOW = Date.parse('2026-07-09T12:00:00Z');

describe('formatRelativeTime', () => {
  it('returns empty string for a null instant', () => {
    expect(formatRelativeTime(0, NOW)).toBe('');
  });

  it('handles the just-now window', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe("à l'instant");
    expect(formatRelativeTime(NOW + 5_000, NOW)).toBe("à l'instant");
  });

  it('formats minutes and hours', () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('il y a 5 min');
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe('il y a 3 h');
  });

  it('formats days up to a week', () => {
    expect(formatRelativeTime(NOW - 2 * 86_400_000, NOW)).toBe('il y a 2 j');
    expect(formatRelativeTime(NOW - 7 * 86_400_000, NOW)).toBe('il y a 7 j');
  });

  it('falls back to a short date beyond a week', () => {
    const out = formatRelativeTime(NOW - 30 * 86_400_000, NOW);
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
