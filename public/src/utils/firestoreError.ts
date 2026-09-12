/**
 * Firestore / Firebase error classification.
 *
 * Source of truth for mapping Firebase error codes to:
 *   - the user-facing i18n message id,
 *   - severity (governs toast type),
 *   - recommended action (signals to retry / reauth / reload UX),
 *   - retryability flag (consumed by `withRetry`).
 *
 * Consumers:
 *   - `useFirestoreErrorHandler` hook — toast + Sentry + reauth CTA
 *   - `withRetry` — backoff loop
 *   - legacy `formatFirestoreError` — kept for in-flight call sites pending migration
 */
import type { MessageId } from '../i18n/messages/fr';

export type ErrorSeverity = 'silent' | 'info' | 'warning' | 'error';
export type ErrorAction = 'retry' | 'reauth' | 'reload' | 'none';

export interface ErrorClassification {
  code: string;
  messageId: MessageId;
  severity: ErrorSeverity;
  action: ErrorAction;
  retryable: boolean;
}

interface FirebaseLikeError {
  code?: string;
  message?: string;
}

const CLASSIFICATION: Record<string, Omit<ErrorClassification, 'code'>> = {
  'permission-denied': {
    messageId: 'error.fs.permissionDenied',
    severity: 'error',
    action: 'reauth',
    retryable: false,
  },
  unauthenticated: {
    messageId: 'error.fs.unauthenticated',
    severity: 'warning',
    action: 'reauth',
    retryable: false,
  },
  'not-found': {
    messageId: 'error.fs.notFound',
    severity: 'info',
    action: 'none',
    retryable: false,
  },
  'already-exists': {
    messageId: 'error.fs.alreadyExists',
    severity: 'info',
    action: 'none',
    retryable: false,
  },
  'failed-precondition': {
    messageId: 'error.fs.failedPrecondition',
    severity: 'warning',
    action: 'reload',
    retryable: false,
  },
  'invalid-argument': {
    messageId: 'error.fs.invalidArgument',
    severity: 'error',
    action: 'none',
    retryable: false,
  },
  aborted: {
    messageId: 'error.fs.aborted',
    severity: 'warning',
    action: 'retry',
    retryable: true,
  },
  unavailable: {
    messageId: 'error.fs.unavailable',
    severity: 'warning',
    action: 'retry',
    retryable: true,
  },
  'deadline-exceeded': {
    messageId: 'error.fs.deadlineExceeded',
    severity: 'warning',
    action: 'retry',
    retryable: true,
  },
  'resource-exhausted': {
    messageId: 'error.fs.resourceExhausted',
    severity: 'error',
    action: 'none',
    retryable: false,
  },
  cancelled: {
    messageId: 'error.fs.generic',
    severity: 'silent',
    action: 'none',
    retryable: false,
  },
  internal: {
    messageId: 'error.fs.generic',
    severity: 'error',
    action: 'none',
    retryable: true,
  },
  'data-loss': {
    messageId: 'error.fs.generic',
    severity: 'error',
    action: 'none',
    retryable: false,
  },
};

const UNKNOWN: Omit<ErrorClassification, 'code'> = {
  messageId: 'error.fs.generic',
  severity: 'error',
  action: 'none',
  retryable: false,
};

/** Classifies an unknown error against the Firestore code table. */
export function classifyError(err: unknown): ErrorClassification {
  const code = (err as FirebaseLikeError)?.code ?? 'unknown';
  return { code, ...(CLASSIFICATION[code] ?? UNKNOWN) };
}

/** Returns true for transient Firestore errors that are safe to retry. */
export function isRetryable(err: unknown): boolean {
  return classifyError(err).retryable;
}

/**
 * Legacy helper — kept for call sites still using the imperative pattern.
 * Prefer `useFirestoreErrorHandler` for new code.
 */
export function formatFirestoreError(
  err: unknown,
  fallback = 'Une erreur est survenue. Réessayez.',
): string {
  if (!err) return fallback;
  const { code, messageId } = classifyError(err);
  // Unknown or generic (no specific i18n key) → caller-provided fallback.
  if (code === 'unknown' || messageId === 'error.fs.generic') return fallback;
  // Legacy FR strings, hardcoded for backward compatibility with existing call
  // sites. New code should resolve `messageId` via useIntl.
  const LEGACY_FR: Partial<Record<MessageId, string>> = {
    'error.fs.permissionDenied': 'Accès refusé — vérifiez vos droits ou reconnectez-vous.',
    'error.fs.unauthenticated': 'Session expirée — veuillez vous reconnecter.',
    'error.fs.notFound': 'Document introuvable — il a peut-être été supprimé.',
    'error.fs.alreadyExists': 'Ce document existe déjà.',
    'error.fs.failedPrecondition': 'Précondition non remplie — rechargez la page.',
    'error.fs.invalidArgument': 'Données invalides — vérifiez les champs saisis.',
    'error.fs.aborted': 'Conflit de données — réessayez.',
    'error.fs.unavailable': 'Service temporairement indisponible — nouvelle tentative en cours…',
    'error.fs.deadlineExceeded': 'Délai dépassé — vérifiez votre connexion.',
    'error.fs.resourceExhausted': 'Quota Firestore atteint — réessayez dans quelques minutes.',
  };
  return LEGACY_FR[messageId] ?? fallback;
}
