import { useCallback } from 'react';
import { useIntl } from 'react-intl';
import { auth } from '../services/firebase';
import { captureException } from '../lib/sentry';
import { toast } from '../lib/toast';
import { classifyError, type ErrorClassification } from '../utils/firestoreError';
import type { MessageId } from '../i18n/messages/fr';

export interface HandleOptions {
  /** Override message id when classification falls back to generic. */
  fallbackKey?: MessageId;
  /** Sentry tag + dedup key (e.g. "transaction.save", "budget.update"). */
  context?: string;
  /** Non-PII extras forwarded to Sentry (auto-scrubbed by lib/sentry). */
  extras?: Record<string, unknown>;
  /** Force-suppress the toast regardless of classification. */
  silent?: boolean;
  /** Custom toast id; defaults to `fb:${code}:${context}` for dedup. */
  toastId?: string;
}

export interface HandledError extends ErrorClassification {
  message: string;
  handled: true;
}

/**
 * Centralised handler for Firestore (and similar) async errors.
 *
 * Surfaces a localised toast (when not silent), forwards the error to Sentry
 * with non-PII tags/extras, and returns the classification so callers can
 * react (e.g. trigger reauth flow).
 */
export function useFirestoreErrorHandler() {
  const { formatMessage } = useIntl();

  const handle = useCallback(
    (err: unknown, opts: HandleOptions = {}): HandledError => {
      const classification = classifyError(err);
      let { severity } = classification;
      const { code, messageId } = classification;

      // Suppress expected races: permission-denied / unauthenticated firing
      // after the user has just signed out (snapshot listeners flush).
      const isLogoutRace =
        !auth.currentUser && (code === 'permission-denied' || code === 'unauthenticated');
      if (isLogoutRace) severity = 'silent';

      const resolvedMessageId =
        opts.fallbackKey && code === 'unknown' ? opts.fallbackKey : messageId;
      const message = formatMessage({ id: resolvedMessageId });

      if (!opts.silent && severity !== 'silent') {
        const toastId = opts.toastId ?? `fb:${code}:${opts.context ?? 'global'}`;
        const duration = severity === 'info' ? 4000 : 6000;
        // The stable `id` lets the Toast component dedup duplicate fires.
        const show = severity === 'info' ? toast.info : toast.error;
        show(message, duration, toastId);
      }

      // Skip Sentry for expected/cosmetic conditions.
      const skipSentry =
        severity === 'silent' || code === 'cancelled' || code === 'unauthenticated';
      if (!skipSentry) {
        captureException(err, {
          tags: {
            fbCode: code,
            ...(opts.context ? { context: opts.context } : {}),
            severity,
          },
          extras: opts.extras,
          fingerprint: ['fs', code, opts.context ?? 'global'],
        });
      }

      return { ...classification, severity, message, handled: true };
    },
    [formatMessage],
  );

  /**
   * Wraps an async call, handling any thrown error transparently.
   * Returns the call's value on success, or `undefined` on handled failure.
   */
  const wrap = useCallback(
    async <T>(fn: () => Promise<T>, opts: HandleOptions = {}): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (err) {
        handle(err, opts);
        return undefined;
      }
    },
    [handle],
  );

  return { handle, wrap };
}

export type UseFirestoreErrorHandler = ReturnType<typeof useFirestoreErrorHandler>;
