import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LoadingFallback } from '../../../public/src/components/shared/LoadingFallback';

describe('LoadingFallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('n’affiche rien avant 200 ms, puis un spinner annoncé', () => {
    render(<LoadingFallback fullScreen />);
    expect(screen.queryByRole('status')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Chargement...');
    // Fond de l'application : aucun éclair blanc entre deux arbres.
    expect(status).toHaveClass('bg-bg', 'fixed', 'inset-0');
  });

  it('reste dans le flux de la page hors plein écran', () => {
    render(<LoadingFallback />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('status')).not.toHaveClass('fixed');
  });
});
