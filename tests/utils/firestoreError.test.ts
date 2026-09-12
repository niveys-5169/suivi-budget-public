import { describe, it, expect } from 'vitest';
import {
  formatFirestoreError,
  isRetryable,
  classifyError,
} from '../../public/src/utils/firestoreError';

describe('firestoreError', () => {
  describe('formatFirestoreError', () => {
    it('returns French message for permission-denied', () => {
      expect(formatFirestoreError({ code: 'permission-denied' })).toContain('Accès refusé');
    });

    it('returns French message for unauthenticated', () => {
      expect(formatFirestoreError({ code: 'unauthenticated' })).toContain('Session expirée');
    });

    it('returns French message for unavailable', () => {
      expect(formatFirestoreError({ code: 'unavailable' })).toContain(
        'temporairement indisponible',
      );
    });

    it('returns French message for deadline-exceeded', () => {
      expect(formatFirestoreError({ code: 'deadline-exceeded' })).toContain('Délai dépassé');
    });

    it('returns the default fallback for unknown codes', () => {
      const msg = formatFirestoreError({ code: 'made-up-code' }, 'fallback');
      expect(msg).toBe('fallback');
    });

    it('returns the default fallback when code is missing', () => {
      expect(formatFirestoreError(new Error('boom'), 'fallback')).toBe('fallback');
    });

    it('returns the default fallback for null/undefined errors', () => {
      expect(formatFirestoreError(null)).toContain('Une erreur est survenue');
      expect(formatFirestoreError(undefined)).toContain('Une erreur est survenue');
    });
  });

  describe('isRetryable', () => {
    it.each(['unavailable', 'deadline-exceeded', 'internal', 'aborted'])(
      'returns true for transient code %s',
      (code) => {
        expect(isRetryable({ code })).toBe(true);
      },
    );

    it.each(['permission-denied', 'unauthenticated', 'not-found', 'invalid-argument'])(
      'returns false for fatal code %s',
      (code) => {
        expect(isRetryable({ code })).toBe(false);
      },
    );

    it('returns false for errors without a code', () => {
      expect(isRetryable(new Error('boom'))).toBe(false);
      expect(isRetryable(null)).toBe(false);
      expect(isRetryable(undefined)).toBe(false);
    });
  });

  describe('classifyError', () => {
    it('classifies permission-denied as error + reauth', () => {
      const c = classifyError({ code: 'permission-denied' });
      expect(c.severity).toBe('error');
      expect(c.action).toBe('reauth');
      expect(c.retryable).toBe(false);
      expect(c.messageId).toBe('error.fs.permissionDenied');
    });

    it('classifies unavailable as warning + retry', () => {
      const c = classifyError({ code: 'unavailable' });
      expect(c.severity).toBe('warning');
      expect(c.action).toBe('retry');
      expect(c.retryable).toBe(true);
    });

    it('classifies cancelled as silent', () => {
      expect(classifyError({ code: 'cancelled' }).severity).toBe('silent');
    });

    it('classifies failed-precondition as warning + reload', () => {
      const c = classifyError({ code: 'failed-precondition' });
      expect(c.severity).toBe('warning');
      expect(c.action).toBe('reload');
    });

    it('falls back to generic error for unknown codes', () => {
      const c = classifyError({ code: 'mystery' });
      expect(c.code).toBe('mystery');
      expect(c.messageId).toBe('error.fs.generic');
      expect(c.severity).toBe('error');
    });

    it('falls back to unknown when code is missing', () => {
      expect(classifyError(new Error('boom')).code).toBe('unknown');
      expect(classifyError(null).code).toBe('unknown');
    });
  });
});
