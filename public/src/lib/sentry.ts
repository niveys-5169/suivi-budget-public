/**
 * Sentry error monitoring — opt-in via environment variable.
 *
 * Activation:
 *   1. npm install @sentry/react
 *   2. Set VITE_SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/XXX in .env.local
 *   3. (Optional) Set VITE_SENTRY_RELEASE to your app version (e.g. git SHA)
 *
 * When VITE_SENTRY_DSN is absent, all calls below are no-ops — zero cost in dev
 * and in production until the DSN is configured.
 */

let _sentry: typeof import('@sentry/react') | null = null;

async function getSentry() {
  if (_sentry) return _sentry;
  if (!import.meta.env.VITE_SENTRY_DSN) return null;

  try {
    _sentry = await import('@sentry/react');
    _sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      release: import.meta.env.VITE_SENTRY_RELEASE,
      environment: import.meta.env.MODE,
      // Capture 100% of errors, 10% of transactions (tune for production load).
      tracesSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      // Do not capture personal financial data in breadcrumbs.
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
          // Scrub request/response bodies that may contain balances.
          if (breadcrumb.data) {
            breadcrumb.data.body = '[scrubbed]';
            breadcrumb.data.response = '[scrubbed]';
          }
        }
        return breadcrumb;
      },
    });
  } catch {
    // @sentry/react not installed — silently degrade.
    _sentry = null;
  }

  return _sentry;
}

// Initialize eagerly (async, non-blocking).
getSentry();

export interface CaptureOptions {
  /** Free-form extras (already-redacted; do not include amounts/PII). */
  extras?: Record<string, unknown>;
  /** Indexed tags for Sentry filtering (e.g. `fbCode`, `context`). */
  tags?: Record<string, string>;
  /** Fingerprint segments — controls grouping. */
  fingerprint?: string[];
}

const SENSITIVE_KEY = /amount|balance|email|iban|notes|description|libelle|montant|commentaire/i;

function redact(extras?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!extras) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extras)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[scrubbed]' : value;
  }
  return out;
}

/** Capture an exception in Sentry. No-op when Sentry is not configured. */
export async function captureException(err: unknown, options?: CaptureOptions) {
  const sentry = await getSentry();
  if (!sentry) return;
  sentry.withScope((scope) => {
    if (options?.tags) scope.setTags(options.tags);
    const sanitized = redact(options?.extras);
    if (sanitized) scope.setExtras(sanitized);
    if (options?.fingerprint) scope.setFingerprint(options.fingerprint);
    sentry.captureException(err);
  });
}

/** Set the authenticated user for Sentry sessions. */
export async function setSentryUser(user: { id: string; email?: string } | null) {
  const sentry = await getSentry();
  if (!sentry) return;
  sentry.setUser(user ? { id: user.id, email: '[scrubbed]' } : null);
}
