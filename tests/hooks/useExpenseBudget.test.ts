import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExpenseBudget } from '../../public/src/hooks/useExpenseBudget';
import { useGlobalData } from '../../public/src/context/GlobalDataContext';
import { useAppState } from '../../public/src/context/AppStateContext';
import type { Recurrence } from '../../public/src/types/banking.types';

vi.mock('../../public/src/context/GlobalDataContext', () => ({
  useGlobalData: vi.fn(),
}));

vi.mock('../../public/src/context/AppStateContext', () => ({
  useAppState: vi.fn(),
}));

const recurrence = (over: Partial<Recurrence>): Recurrence =>
  ({
    id: 'r1',
    label: 'Salaire',
    category: 'Revenus',
    expectedAmount: 1000,
    dayOfMonth: 1,
    active: true,
    ...over,
  }) as Recurrence;

describe('useExpenseBudget', () => {
  const mockUseGlobalData = vi.mocked(useGlobalData);
  const mockUseAppState = vi.mocked(useAppState);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppState.mockReturnValue({ budgetPeriodMode: 'month' } as never);
  });

  it('sums declared salaries and active monthly recurring income', () => {
    mockUseGlobalData.mockReturnValue({
      ravConfig: { provision_salaires: { nico: { montant: 2000, categorie: 'Salaire Nico' } } },
      recurrences: [recurrence({ expectedAmount: 500 })],
    } as never);

    const { result } = renderHook(() => useExpenseBudget());
    expect(result.current).toBe(2500);
  });

  it('ignores inactive and expense recurrences', () => {
    mockUseGlobalData.mockReturnValue({
      ravConfig: null,
      recurrences: [
        recurrence({ id: 'inactive', expectedAmount: 500, active: false }),
        recurrence({ id: 'expense', expectedAmount: -300 }),
      ],
    } as never);

    const { result } = renderHook(() => useExpenseBudget());
    expect(result.current).toBe(0);
  });

  it('multiplies by 12 in yearly budget period mode', () => {
    mockUseAppState.mockReturnValue({ budgetPeriodMode: 'year' } as never);
    mockUseGlobalData.mockReturnValue({
      ravConfig: { provision_salaires: { nico: { montant: 1000, categorie: 'Salaire Nico' } } },
      recurrences: [],
    } as never);

    const { result } = renderHook(() => useExpenseBudget());
    expect(result.current).toBe(12000);
  });
});
