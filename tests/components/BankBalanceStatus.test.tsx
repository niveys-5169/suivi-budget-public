import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BankBalanceStatus } from '../../public/src/components/banking/BankBalanceStatus';
import type { AccountBalance } from '../../public/src/types/banking.types';

const balance = (changes: Partial<AccountBalance> = {}): AccountBalance => ({
  id: 'LCL',
  compte: 'LCL',
  current_balance: 145.5,
  source: 'enable_banking',
  source_timestamp: null,
  status: 'pending_review',
  balanceType: 'XPCD',
  bankDate: '2026-10-13',
  ...changes,
});

describe('BankBalanceStatus', () => {
  it('identifies the provisional bank balance even without a Linxo comparison', () => {
    render(<BankBalanceStatus balance={balance()} />);
    expect(screen.getByText(/Solde comptable provisoire/)).toBeVisible();
    expect(screen.getByText(/Date bancaire : 2026-10-13/)).toBeVisible();
  });

  it('keeps the provisional label when the amounts match', () => {
    render(
      <BankBalanceStatus
        balance={balance({
          crossControl: { status: 'waiting', difference: 0, compte: 'LCL' },
        })}
      />,
    );
    expect(screen.getByText(/Solde comptable provisoire/)).toBeVisible();
    expect(screen.queryByText(/Différence/)).not.toBeInTheDocument();
  });

  it('preserves the compact display for a booked balance without a difference', () => {
    const { container } = render(<BankBalanceStatus balance={balance({ balanceType: 'CLBD' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
