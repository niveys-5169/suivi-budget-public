import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransactionGroupedList } from '../../../public/src/components/transactions/TransactionGroupedList';
import { IntlProvider } from 'react-intl';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mockTransactions = Array.from({ length: 16 }, (_, i) => ({
  id: `tx-${i}`,
  libelle: `Transaction ${i}`,
  montant: -10 - i,
  date: new Date(2026, 4, 15 - i).toISOString().split('T')[0]!,
  categorie: 'Alimentation',
  compte: 'Compte Courant',
  pointe: true,
}));

describe('TransactionGroupedList — PWA Infinite Scroll & Sorting', () => {
  let originalIntersectionObserver: any;
  const mockHandlers = {
    onOpenDetail: vi.fn(),
    onTogglePointe: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    originalIntersectionObserver = window.IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  it('renders only the first 3 days/groups initially and shows the sentinel', () => {
    render(
      <IntlProvider locale="fr">
        <TransactionGroupedList transactions={mockTransactions} {...mockHandlers} />
      </IntlProvider>,
    );

    // Initial visible count of days/groups is 3, so we should see transactions from first 3 dates
    expect(screen.getByText('Transaction 0')).toBeInTheDocument();
    expect(screen.getByText('Transaction 1')).toBeInTheDocument();
    expect(screen.getByText('Transaction 2')).toBeInTheDocument();

    // The loader sentinel should be visible
    expect(screen.getByText('Chargement de la suite...')).toBeInTheDocument();
  });

  it('loads more groups when the sentinel becomes visible', () => {
    let observerCallback: any = null;

    window.IntersectionObserver = class IntersectionObserver {
      constructor(cb: any) {
        observerCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;

    render(
      <IntlProvider locale="fr">
        <TransactionGroupedList transactions={mockTransactions} {...mockHandlers} />
      </IntlProvider>,
    );

    expect(observerCallback).not.toBeNull();

    // Verify initially transaction 3 (from 4th day/group) is not visible
    expect(screen.queryByText('Transaction 3')).toBeNull();

    // Trigger observer callback with isIntersecting: true
    act(() => {
      observerCallback([{ isIntersecting: true }]);
    });

    // visibleDaysCount should increase from 3 to 6, so Transaction 3 should now be visible
    expect(screen.getByText('Transaction 3')).toBeInTheDocument();
  });

  it('appends the commentaire to the metadata line instead of a dedicated block', () => {
    const [first, ...rest] = mockTransactions;
    render(
      <IntlProvider locale="fr">
        <TransactionGroupedList
          transactions={[{ ...first!, commentaire: 'Remboursé par Paul' }, ...rest]}
          {...mockHandlers}
        />
      </IntlProvider>,
    );

    const meta = screen.getByText(/Compte Courant • Remboursé par Paul/);
    expect(meta).toHaveAttribute('title', 'Remboursé par Paul');
    // Pas de bouton de dépliage : le texte complet reste dans le détail.
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
  });

  it('leaves the metadata line untouched when there is no commentaire', () => {
    render(
      <IntlProvider locale="fr">
        <TransactionGroupedList transactions={mockTransactions} {...mockHandlers} />
      </IntlProvider>,
    );

    const meta = screen.getAllByText(/Alimentation • Compte Courant/)[0]!;
    expect(meta.textContent).toBe('Alimentation • Compte Courant');
    expect(meta).not.toHaveAttribute('title');
  });
});
