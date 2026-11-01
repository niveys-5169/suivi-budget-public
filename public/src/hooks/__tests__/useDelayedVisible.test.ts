import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelayedVisible } from '../useDelayedVisible';

describe('useDelayedVisible', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reste faux avant le délai, devient vrai une fois écoulé', () => {
    const { result } = renderHook(() => useDelayedVisible(200));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('annule le minuteur au démontage (aucune mise à jour tardive)', () => {
    const { unmount } = renderHook(() => useDelayedVisible(200));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
