import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCashflowForecast } from '../../public/src/hooks/useCashflowForecast';
import { useGlobalData } from '../../public/src/context/GlobalDataContext';

// Mock dependencies
vi.mock('../../public/src/hooks/useBalances', () => ({
  useBalances: () => ({
    checkingTotal: 1000,
  }),
}));

vi.mock('../../public/src/context/GlobalDataContext', () => ({
  useGlobalData: vi.fn(),
}));

describe('useCashflowForecast hook', () => {
  const mockUseGlobalData = vi.mocked(useGlobalData);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('projects recurring incomes using dayOfMonth from recurrences collection', () => {
    // Set system time to June 1st, 2026
    vi.setSystemTime(new Date(2026, 5, 1));

    mockUseGlobalData.mockReturnValue({
      accountBalances: [],
      ownerMapping: { owners: [], accounts: {}, savings_patterns: {}, default_owner: '' },
      ravConfig: null,
      recurrences: [
        {
          id: 'rec-salary',
          label: 'Salaire Romane',
          category: 'Revenus',
          expectedAmount: 2000,
          dayOfMonth: 10,
          active: true,
          createdAt: {} as any,
        },
      ],
      loading: false,
    });

    const { result } = renderHook(() => useCashflowForecast(30, 0));

    // Verify that the salary event is projected on June 10th (dayOfMonth: 10)
    const dayWithSalary = result.current.days.find((d) => d.date === '2026-06-10');
    expect(dayWithSalary).toBeDefined();
    expect(dayWithSalary?.events).toHaveLength(1);
    expect(dayWithSalary?.events[0]!.label).toBe('Salaire Romane');
    expect(dayWithSalary?.events[0]!.amount).toBe(2000);

    // Verify that there is no salary event on June 1st (default fallback)
    const dayOne = result.current.days.find((d) => d.date === '2026-06-01');
    expect(dayOne?.events).toHaveLength(0);
  });

  it('merges recurrences incomes with ravConfig incomes, avoiding duplicates', () => {
    vi.setSystemTime(new Date(2026, 4, 31));

    mockUseGlobalData.mockReturnValue({
      accountBalances: [],
      ownerMapping: { owners: [], accounts: {}, savings_patterns: {}, default_owner: '' },
      ravConfig: {
        revenu_mensuel_net: null,
        revenu_categories: null,
        depense_categories: null,
        provision_salaires: {
          nico: { montant: 2500, categorie: 'Salaire Nico' },
          romane: { montant: 2000, categorie: 'Salaire Romane' }, // duplicate of the recurrence
        },
      },
      recurrences: [
        {
          id: 'rec-salary-romane',
          label: 'Salaire Romane',
          category: 'Revenus',
          expectedAmount: 2000,
          dayOfMonth: 10,
          active: true,
          createdAt: {} as any,
        },
      ],
      loading: false,
    });

    const { result } = renderHook(() => useCashflowForecast(30, 0));

    // Verify Salaire Romane (from recurrences) is projected on June 10th
    const dayTen = result.current.days.find((d) => d.date === '2026-06-10');
    expect(dayTen?.events).toHaveLength(1);
    expect(dayTen?.events[0]!.label).toBe('Salaire Romane');
    expect(dayTen?.events[0]!.amount).toBe(2000);

    // Verify Salaire Nico (from ravConfig fallback) is projected on June 1st
    const dayOne = result.current.days.find((d) => d.date === '2026-06-01');
    expect(dayOne?.events).toHaveLength(1);
    expect(dayOne?.events[0]!.label).toBe('Salaire Nico');
    expect(dayOne?.events[0]!.amount).toBe(2500);

    // Verify that Salaire Romane from ravConfig was NOT duplicated on June 1st
    const duplicateEvent = dayOne?.events.find((e) => e.label === 'Salaire Romane');
    expect(duplicateEvent).toBeUndefined();
  });

  it('deduplicates identical recurrences and matches ravConfig by category', () => {
    vi.setSystemTime(new Date(2026, 4, 31));

    mockUseGlobalData.mockReturnValue({
      accountBalances: [],
      ownerMapping: { owners: [], accounts: {}, savings_patterns: {}, default_owner: '' },
      ravConfig: {
        revenu_mensuel_net: null,
        revenu_categories: null,
        depense_categories: null,
        provision_salaires: {
          nico: { montant: 3000, categorie: 'Salaire Nico' },
        },
      },
      recurrences: [
        // Duplicate CAF entries
        {
          id: 'caf-1',
          label: 'SEPA',
          category: 'CAF',
          expectedAmount: 150,
          dayOfMonth: 5,
          active: true,
          createdAt: {} as any,
        },
        {
          id: 'caf-2',
          label: 'SEPA',
          category: 'CAF',
          expectedAmount: 150,
          dayOfMonth: 5,
          active: true,
          createdAt: {} as any,
        },
        // Recurrence with label "SEPA" but category "Salaire Nico" (should match ravConfig)
        {
          id: 'salary-nico',
          label: 'SEPA',
          category: 'Salaire Nico',
          expectedAmount: 3000,
          dayOfMonth: 26,
          active: true,
          createdAt: {} as any,
        },
      ],
      loading: false,
    });

    const { result } = renderHook(() => useCashflowForecast(30, 0));

    // Verify CAF is projected ONLY ONCE on June 5th
    const dayFive = result.current.days.find((d) => d.date === '2026-06-05');
    expect(dayFive?.events).toHaveLength(1);
    expect(dayFive?.events[0]!.label).toBe('SEPA');
    expect(dayFive?.events[0]!.amount).toBe(150);

    // Verify Salaire Nico (from recurrences) is projected on June 26th
    const day26 = result.current.days.find((d) => d.date === '2026-06-26');
    expect(day26?.events).toHaveLength(1);
    expect(day26?.events[0]!.amount).toBe(3000);

    // Verify Salaire Nico from ravConfig was NOT duplicated on June 1st
    const dayOne = result.current.days.find((d) => d.date === '2026-06-01');
    const duplicateEvent = dayOne?.events.find((e) => e.label === 'Salaire Nico');
    expect(duplicateEvent).toBeUndefined();
  });
});
