import { isRetryable } from './firestoreError';

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

/**
 * Wraps an async Firestore operation with exponential-backoff retry.
 * Only retries on transient errors (unavailable, deadline-exceeded, etc.).
 * Non-retryable errors (permission-denied, invalid-argument…) are re-thrown immediately.
 *
 * @example
 * await withRetry(() => updateDoc(ref, data));
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 500 }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err) || attempt === maxAttempts) {
        throw err;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
