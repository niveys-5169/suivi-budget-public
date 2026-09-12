import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsStandalone } from '../useIsStandalone';

type Listener = () => void;

/** Installe un mock de matchMedia dont on contrôle `matches` et le change. */
const mockMatchMedia = (initialMatches: boolean) => {
  const listeners = new Set<Listener>();
  let matches = initialMatches;
  const mql = {
    get matches() {
      return matches;
    },
    media: '(display-mode: standalone)',
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    emitChange: (next: boolean) => {
      matches = next;
      listeners.forEach((cb) => cb());
    },
  };
};

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error — nettoyage du mock entre les tests
  delete window.matchMedia;
  delete (window.navigator as Navigator & { standalone?: boolean }).standalone;
});

describe('useIsStandalone', () => {
  it('returns true when the display-mode is standalone', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(true);
  });

  it('returns false in a normal browser tab', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(false);
  });

  it('returns true for the iOS legacy navigator.standalone flag', () => {
    mockMatchMedia(false);
    (window.navigator as Navigator & { standalone?: boolean }).standalone = true;
    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(true);
  });

  it('reacts to display-mode changes', () => {
    const { emitChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(false);
    act(() => emitChange(true));
    expect(result.current).toBe(true);
  });
});
