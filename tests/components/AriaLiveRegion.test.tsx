import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { AriaLiveRegion } from '../../public/src/components/shared/AriaLiveRegion';

const fireToast = (
  type: 'success' | 'error' | 'info' | 'loading',
  message: string,
  id?: string,
) => {
  window.dispatchEvent(
    new CustomEvent('show-toast', {
      detail: { type, message, duration: 0, id },
    }),
  );
};

afterEach(() => cleanup());

describe('AriaLiveRegion', () => {
  it('renders two sr-only regions: polite (role=status) and assertive (role=alert)', () => {
    render(<AriaLiveRegion />);
    const polite = screen.getByRole('status');
    const assertive = screen.getByRole('alert');

    expect(polite).toHaveAttribute('aria-live', 'polite');
    expect(polite).toHaveAttribute('aria-atomic', 'true');
    expect(polite).toHaveClass('sr-only');

    expect(assertive).toHaveAttribute('aria-live', 'assertive');
    expect(assertive).toHaveAttribute('aria-atomic', 'true');
    expect(assertive).toHaveClass('sr-only');
  });

  it('announces success messages in the polite region with French prefix', () => {
    render(<AriaLiveRegion />);
    act(() => fireToast('success', 'Budget enregistré', 'tid-1'));

    const polite = screen.getByRole('status');
    expect(polite).toHaveTextContent('Succès : Budget enregistré');
  });

  it('announces error messages in the assertive region', () => {
    render(<AriaLiveRegion />);
    act(() => fireToast('error', 'Connexion perdue', 'tid-2'));

    const assertive = screen.getByRole('alert');
    expect(assertive).toHaveTextContent('Erreur : Connexion perdue');

    // Polite region should remain empty for errors.
    expect(screen.getByRole('status').textContent?.trim()).toBe('');
  });

  it('uses the appropriate prefix for info and loading types', () => {
    render(<AriaLiveRegion />);
    act(() => {
      fireToast('info', 'Synchronisation en cours', 'tid-3');
      fireToast('loading', 'Chargement des comptes', 'tid-4');
    });

    const polite = screen.getByRole('status');
    expect(polite).toHaveTextContent('Information : Synchronisation en cours');
    expect(polite).toHaveTextContent('Chargement : Chargement des comptes');
  });

  it('ignores show-toast events with an empty message', () => {
    render(<AriaLiveRegion />);
    act(() => fireToast('success', ''));

    expect(screen.getByRole('status').textContent?.trim()).toBe('');
    expect(screen.getByRole('alert').textContent?.trim()).toBe('');
  });
});
