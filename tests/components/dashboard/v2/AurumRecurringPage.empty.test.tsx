import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AurumRecurringPage } from '../../../../public/src/components/dashboard/v2/AurumRecurringPage';
import { TransactionContext } from '../../../../public/src/context/TransactionContext';

vi.mock('../../../../public/src/hooks/useBudget', () => ({
  useBudget: () => ({ baseBudgets: [] }),
}));
const globalData = vi.hoisted(() => ({ loading: false }));
vi.mock('../../../../public/src/context/GlobalDataContext', () => ({
  useGlobalData: () => ({ recurrences: [], loading: globalData.loading }),
}));

const contextValue = { transactions: [], togglePointe: vi.fn(), bulkUpdate: vi.fn() };

describe('AurumRecurringPage — aucune récurrence', () => {
  it('explique quoi faire et mène aux transactions', () => {
    render(
      <MemoryRouter initialEntries={['/recurring']}>
        <TransactionContext.Provider value={contextValue as any}>
          <Routes>
            <Route path="/recurring" element={<AurumRecurringPage onBack={vi.fn()} />} />
            <Route path="/transactions" element={<div>Page transactions</div>} />
          </Routes>
        </TransactionContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Aucune récurrence configurée')).toBeInTheDocument();
    expect(screen.getByText(/se crée depuis une transaction existante/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voir les transactions' }));
    expect(screen.getByText('Page transactions')).toBeInTheDocument();
  });

  it('n’affiche pas l’état vide tant que les récurrences chargent', () => {
    globalData.loading = true;
    render(
      <MemoryRouter>
        <TransactionContext.Provider value={contextValue as any}>
          <AurumRecurringPage onBack={vi.fn()} />
        </TransactionContext.Provider>
      </MemoryRouter>,
    );
    globalData.loading = false;

    expect(screen.queryByText('Aucune récurrence configurée')).toBeNull();
  });
});
