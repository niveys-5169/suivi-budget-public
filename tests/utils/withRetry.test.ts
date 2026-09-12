import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../../public/src/utils/withRetry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the value on first success without delay', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient errors then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: 'unavailable' })
      .mockRejectedValueOnce({ code: 'deadline-exceeded' })
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { baseDelayMs: 100 });
    // Advance timers through the two backoff delays (100ms then 200ms).
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on non-retryable errors (permission-denied)', async () => {
    const fn = vi.fn().mockRejectedValue({ code: 'permission-denied' });
    await expect(withRetry(fn)).rejects.toEqual({ code: 'permission-denied' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on unknown errors without code', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(withRetry(fn)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts on persistent transient error', async () => {
    const err = { code: 'unavailable' };
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 50 });
    const rejection = expect(promise).rejects.toEqual(err);

    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(100);
    await rejection;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses exponential backoff (base * 2^(attempt-1))', async () => {
    const err = { code: 'unavailable' };
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 200 });
    const rejection = expect(promise).rejects.toEqual(err);

    // First retry waits baseDelay (200ms), second waits 400ms.
    await vi.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(1); // still waiting on first backoff
    await vi.advanceTimersByTimeAsync(1);
    // Microtask: attempt 2 fires
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(399);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
