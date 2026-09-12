import { describe, it, expect } from 'vitest';
import { fmt, esc, escJs } from '../../public/src/utils/format';

describe('fmt', () => {
  it('formats a number as EUR currency', () => {
    const result = fmt(1234.5);
    expect(result).toContain('1');
    expect(result).toContain('€');
  });

  it('returns — for NaN', () => {
    expect(fmt(NaN)).toBe('—');
    expect(fmt('abc')).toBe('—');
  });

  it('handles zero', () => {
    const result = fmt(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('handles negative values', () => {
    const result = fmt(-50);
    expect(result).toContain('50');
    expect(result).toContain('€');
  });

  it('accepts a numeric string', () => {
    const result = fmt('42.5');
    expect(result).toContain('42');
    expect(result).toContain('€');
  });
});

describe('esc', () => {
  it('escapes ampersand', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes < and >', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(esc("it's")).toBe('it&#39;s');
  });

  it('handles null/undefined gracefully', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('escJs', () => {
  it('escapes backslashes', () => {
    expect(escJs('a\\b')).toBe('a\\\\b');
  });

  it('escapes single quotes', () => {
    expect(escJs("it's")).toBe("it\\'s");
  });

  it('escapes newlines and carriage returns', () => {
    expect(escJs('a\nb')).toBe('a\\nb');
    expect(escJs('a\rb')).toBe('a\\rb');
  });

  it('handles null/undefined gracefully', () => {
    expect(escJs(null)).toBe('');
    expect(escJs(undefined)).toBe('');
  });
});
