import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import { ReconciliationModal } from '../../public/src/components/ReconciliationModal';
import type { AccountBalance } from '../../public/src/types/balances';

expect.extend(toHaveNoViolations);

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

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn()),
}));

const accountWithoutGaps: AccountBalance = {
  id: 'a1',
  compte: 'LCL Courant',
  current_balance: 4500,
  discrepancies: [],
} as any;

const accountWithGaps: AccountBalance = {
  id: 'a2',
  compte: 'Boursorama',
  current_balance: 12000,
  discrepancies: [
    {
      id: 'd1',
      status: 'unresolved',
      description: 'Solde divergent entre sources',
      source_1: 'Bank',
      source_2: 'Manual',
      value_1: 12000,
      value_2: 11950,
    } as any,
  ],
} as any;

describe('ReconciliationModal — accessibility', () => {
  beforeAll(() => {
    if (!document.body) document.body = document.createElement('body');
  });

  it('has no axe violations with no unresolved gaps', async () => {
    const { container } = render(
      <ReconciliationModal isOpen onClose={vi.fn()} account={accountWithoutGaps} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when an unresolved gap is present', async () => {
    const { container } = render(
      <ReconciliationModal isOpen onClose={vi.fn()} account={accountWithGaps} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ReconciliationModal isOpen={false} onClose={vi.fn()} account={accountWithoutGaps} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
