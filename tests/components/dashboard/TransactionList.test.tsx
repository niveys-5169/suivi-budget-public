import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransactionList } from '../../../public/src/components/dashboard/TransactionList';
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
  // Ensure we get unique dates so we have at least 8 groups
  date: new Date(2026, 4, 15 - i).toISOString(),
  categorie: 'Alimentation',
  compte: 'Compte Courant',
  pointe: false,
}));

describe('TransactionList — Infinite Scroll', () => {
  let originalIntersectionObserver: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalIntersectionObserver = window.IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  it('renders only the first 3 groups initially and shows the sentinel', () => {
    render(
      <IntlProvider locale="fr">
        <TransactionList transactions={mockTransactions} />
      </IntlProvider>,
    );

    // Initial visible count of groups is 3, so we should see transactions from first 3 dates
    expect(screen.getByText('Transaction 0')).toBeInTheDocument();
    expect(screen.getByText('Transaction 1')).toBeInTheDocument();
    expect(screen.getByText('Transaction 2')).toBeInTheDocument();

    // Since only 3 groups are visible out of 16, the loader sentinel should be visible
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
        <TransactionList transactions={mockTransactions} />
      </IntlProvider>,
    );

    expect(observerCallback).not.toBeNull();

    // Verify initially transaction 3 (from 4th group/date) is not visible
    expect(screen.queryByText('Transaction 3')).toBeNull();

    // Trigger observer callback with isIntersecting: true
    act(() => {
      observerCallback([{ isIntersecting: true }]);
    });

    // visibleGroupsCount should increase from 3 to 6, so Transaction 3 should now be visible
    expect(screen.getByText('Transaction 3')).toBeInTheDocument();
  });
});
