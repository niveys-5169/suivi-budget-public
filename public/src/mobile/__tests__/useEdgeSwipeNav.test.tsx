import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEdgeSwipeNav } from '../useEdgeSwipeNav';

const VIEWPORT = 1024;

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
};

const SwipeSurface = () => {
  const { onTouchStart, onTouchEnd } = useEdgeSwipeNav();
  return <div data-testid="surface" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SwipeSurface />
      <LocationProbe />
      <Routes>
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

/** Simulate a swipe from (startX) to (endX) at a roughly constant Y. */
const swipe = (startX: number, endX: number, startY = 300, endY = 300) => {
  const surface = screen.getByTestId('surface');
  fireEvent.touchStart(surface, { touches: [{ clientX: startX, clientY: startY }] });
  fireEvent.touchEnd(surface, { changedTouches: [{ clientX: endX, clientY: endY }] });
};

const pathname = () => screen.getByTestId('pathname').textContent;

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { value: VIEWPORT, configurable: true });
});

describe('useEdgeSwipeNav', () => {
  it('navigates to the next tab on a right-edge swipe left', () => {
    renderAt('/analyse');
    swipe(VIEWPORT - 5, VIEWPORT - 120);
    expect(pathname()).toBe('/budgets');
  });

  it('navigates to the previous tab on a left-edge swipe right', () => {
    renderAt('/analyse');
    swipe(5, 120);
    expect(pathname()).toBe('/transactions');
  });

  it('does not navigate past the last tab', () => {
    renderAt('/patrimoine');
    swipe(VIEWPORT - 5, VIEWPORT - 120);
    expect(pathname()).toBe('/patrimoine');
  });

  it('does not navigate before the first tab', () => {
    renderAt('/');
    swipe(5, 120);
    expect(pathname()).toBe('/');
  });

  it('ignores gestures that do not start near an edge', () => {
    renderAt('/analyse');
    swipe(VIEWPORT / 2, VIEWPORT / 2 - 120);
    expect(pathname()).toBe('/analyse');
  });

  it('ignores predominantly vertical gestures', () => {
    renderAt('/analyse');
    swipe(VIEWPORT - 5, VIEWPORT - 70, 300, 500);
    expect(pathname()).toBe('/analyse');
  });

  it('ignores short swipes below the threshold', () => {
    renderAt('/analyse');
    swipe(VIEWPORT - 5, VIEWPORT - 35);
    expect(pathname()).toBe('/analyse');
  });

  it('ignores a right-edge swipe in the wrong direction', () => {
    renderAt('/analyse');
    swipe(VIEWPORT - 5, VIEWPORT - 5 + 120);
    expect(pathname()).toBe('/analyse');
  });

  it('is disabled on routes outside the main tabs', () => {
    renderAt('/qa');
    swipe(VIEWPORT - 5, VIEWPORT - 120);
    expect(pathname()).toBe('/qa');
  });
});
