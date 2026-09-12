import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFirestoreErrorHandler } from '../../public/src/hooks/useFirestoreErrorHandler';

vi.mock('../../public/src/services/firebase', () => ({
  auth: { currentUser: { uid: 'test-user' } },
  db: {},
  googleProvider: {},
}));

vi.mock('../../public/src/lib/sentry', () => ({
  captureException: vi.fn(),
}));

import { captureException } from '../../public/src/lib/sentry';

const dispatchSpy = vi.fn();
beforeEach(() => {
  dispatchSpy.mockReset();
  vi.mocked(captureException).mockReset();
  window.dispatchEvent = dispatchSpy as unknown as typeof window.dispatchEvent;
});

const Probe: React.FC<{ onReady: (api: ReturnType<typeof useFirestoreErrorHandler>) => void }> = ({
  onReady,
}) => {
  const api = useFirestoreErrorHandler();
  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
};

type HookAPI = ReturnType<typeof useFirestoreErrorHandler>;
function mount(): HookAPI {
  const ref: { current: HookAPI | null } = { current: null };
  render(<Probe onReady={(received) => (ref.current = received)} />);
  if (!ref.current) throw new Error('hook did not initialise');
  return ref.current;
}

describe('useFirestoreErrorHandler', () => {
  it('classifies a known Firestore error and emits a toast', () => {
    const api = mount();
    let result: ReturnType<typeof api.handle> | undefined;
    act(() => {
      result = api.handle({ code: 'unavailable' }, { context: 'tx.save' });
    });
    expect(result?.severity).toBe('warning');
    expect(result?.action).toBe('retry');
    expect(result?.retryable).toBe(true);
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe('show-toast');
    expect(event.detail.id).toBe('fb:unavailable:tx.save');
    expect(event.detail.type).toBe('error');
  });

  it('suppresses the toast when silent option is set', () => {
    const api = mount();
    act(() => {
      api.handle({ code: 'unavailable' }, { silent: true });
    });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('suppresses the toast for cancelled (silent severity)', () => {
    const api = mount();
    act(() => {
      api.handle({ code: 'cancelled' });
    });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('forwards classification + tags to Sentry', () => {
    const api = mount();
    act(() => {
      api.handle({ code: 'invalid-argument' }, { context: 'budget.save', extras: { id: 'b1' } });
    });
    expect(captureException).toHaveBeenCalledWith(
      { code: 'invalid-argument' },
      expect.objectContaining({
        tags: expect.objectContaining({ fbCode: 'invalid-argument', context: 'budget.save' }),
        extras: { id: 'b1' },
        fingerprint: ['fs', 'invalid-argument', 'budget.save'],
      }),
    );
  });

  it('skips Sentry for cancelled', () => {
    const api = mount();
    act(() => {
      api.handle({ code: 'cancelled' });
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it('skips Sentry for unauthenticated (expected on logout)', () => {
    const api = mount();
    act(() => {
      api.handle({ code: 'unauthenticated' });
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it('wrap returns the resolved value on success', async () => {
    const api = mount();
    const value = await api.wrap(async () => 42);
    expect(value).toBe(42);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('wrap returns undefined on caught failure and toasts', async () => {
    const api = mount();
    const value = await api.wrap(async () => {
      throw { code: 'unavailable' };
    });
    expect(value).toBeUndefined();
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
