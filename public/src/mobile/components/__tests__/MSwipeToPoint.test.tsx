import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  MSwipeToPoint,
  resolveSwipeAction,
  SWIPE_THRESHOLD,
  LONG_PRESS_MS,
} from '../MSwipeToPoint';

describe('resolveSwipeAction', () => {
  it('points an unpointed row on a swipe past the right threshold', () => {
    expect(resolveSwipeAction(SWIPE_THRESHOLD + 10, false)).toBe(true);
  });

  it('unpoints a pointed row on a swipe past the left threshold', () => {
    expect(resolveSwipeAction(-(SWIPE_THRESHOLD + 10), true)).toBe(false);
  });

  it('does nothing when the swipe is below the threshold', () => {
    expect(resolveSwipeAction(SWIPE_THRESHOLD - 1, false)).toBeNull();
    expect(resolveSwipeAction(-(SWIPE_THRESHOLD - 1), true)).toBeNull();
  });

  it('does nothing when the target state already matches', () => {
    expect(resolveSwipeAction(SWIPE_THRESHOLD + 10, true)).toBeNull();
    expect(resolveSwipeAction(-(SWIPE_THRESHOLD + 10), false)).toBeNull();
  });
});

describe('MSwipeToPoint — appui long', () => {
  afterEach(() => vi.useRealTimers());

  const renderRow = (pointed: boolean, onTogglePointe: (id: string, p: boolean) => void) =>
    render(
      <MSwipeToPoint id="tx-1" pointed={pointed} onTogglePointe={onTogglePointe}>
        <button>row</button>
      </MSwipeToPoint>,
    );

  it('bascule le pointage après un maintien prolongé', () => {
    vi.useFakeTimers();
    const onTogglePointe = vi.fn();
    renderRow(false, onTogglePointe);
    fireEvent.pointerDown(screen.getByText('row'), { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onTogglePointe).toHaveBeenCalledWith('tx-1', true);
  });

  it('annule l’appui long si le doigt bouge (swipe/scroll)', () => {
    vi.useFakeTimers();
    const onTogglePointe = vi.fn();
    renderRow(false, onTogglePointe);
    const row = screen.getByText('row');
    fireEvent.pointerDown(row, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(row, { clientX: 40, clientY: 12 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onTogglePointe).not.toHaveBeenCalled();
  });
});
