import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMonthlySavingsAccounts,
  getMonthlySavingsBounds,
  useMonthlySavingsPosition,
} from '../../public/src/hooks/useMonthlySavingsPosition';

const firestore = vi.hoisted(() => ({
  history: [] as Array<Record<string, unknown>>,
  whereCalls: [] as Array<[string, string, string]>,
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  where: (field: string, op: string, value: string) => {
    firestore.whereCalls.push([field, op, value]);
    return { field, op, value };
  },
  orderBy: (field: string) => ({ field }),
  query: (source: { name: string }) => source,
  getDocs: async (source: { name: string }) => ({
    docs:
      source.name === 'placement_history'
        ? firestore.history.map((data, index) => ({ id: `h${index}`, data: () => data }))
        : [],
  }),
}));
vi.mock('../../public/src/services/firebase', () => ({ db: {} }));
vi.mock('../../public/src/context/GlobalDataContext', () => ({
  useGlobalData: () => ({ accountBalances: [], loading: false }),
}));

describe('buildMonthlySavingsAccounts', () => {
  it('utilise les bornes exactes du mois terminé et conserve les comptes manquants', () => {
    const accounts = buildMonthlySavingsAccounts({
      month: '2026-08',
      isCompleteMonth: true,
      liveOperatingBalances: [
        { id: 'lcl', compte: 'LCL', current_balance: 900 },
        { id: 'bfor', compte: 'BforBank', current_balance: 600 },
      ],
      savingsBalances: [{ id: 'livret', compte: 'Livret A', current_balance: 5_000 }],
      history: [
        {
          assetId: 'nicolas_courant_lcl',
          date: '2026-08-01',
          nom: 'LCL',
          montant: 1_000,
          type: 'courants',
          owner: 'nicolas',
        },
        {
          assetId: 'nicolas_courant_lcl',
          date: '2026-09-01',
          nom: 'LCL',
          montant: 1_100,
          type: 'courants',
          owner: 'nicolas',
        },
        {
          assetId: 'nicolas_courant_bforbank',
          date: '2026-09-01',
          nom: 'BforBank',
          montant: 600,
          type: 'courants',
          owner: 'nicolas',
        },
      ],
    });

    expect(accounts).toEqual([
      {
        id: 'nicolas_courant_bforbank',
        name: 'BforBank',
        owner: 'nicolas',
        role: 'OPERATING',
        openingBalance: null,
        closingBalance: 600,
      },
      {
        id: 'nicolas_courant_lcl',
        name: 'LCL',
        owner: 'nicolas',
        role: 'OPERATING',
        openingBalance: 1_000,
        closingBalance: 1_100,
      },
      {
        id: 'livret',
        name: 'Livret A',
        role: 'SAVINGS',
        openingBalance: null,
        closingBalance: null,
      },
    ]);
  });

  it('utilise le solde live comme clôture du mois courant', () => {
    const accounts = buildMonthlySavingsAccounts({
      month: '2026-09',
      isCompleteMonth: false,
      liveOperatingBalances: [{ id: 'lcl', compte: 'LCL', current_balance: 1_150 }],
      savingsBalances: [],
      history: [
        {
          assetId: 'nicolas_courant_lcl',
          date: '2026-09-01',
          nom: 'LCL',
          montant: 1_000,
          type: 'courants',
          owner: 'nicolas',
        },
      ],
    });

    expect(accounts[0]).toMatchObject({ openingBalance: 1_000, closingBalance: 1_150 });
  });

  const lclPoint = (date: string, montant: number) => ({
    assetId: 'nicolas_courant_lcl',
    date,
    nom: 'LCL',
    montant,
    type: 'courants',
    owner: 'nicolas',
  });
  const june2026 = (history: ReturnType<typeof lclPoint>[]) =>
    buildMonthlySavingsAccounts({
      month: '2026-06',
      isCompleteMonth: true,
      liveOperatingBalances: [{ id: 'lcl', compte: 'LCL', current_balance: 1_300 }],
      savingsBalances: [],
      history,
    });

  it("prend le point de fin du mois précédent comme ouverture quand le 1er n'existe pas", () => {
    const accounts = june2026([lclPoint('2026-05-31', 1_000), lclPoint('2026-07-01', 1_200)]);

    expect(accounts[0]).toMatchObject({ openingBalance: 1_000, closingBalance: 1_200 });
  });

  it('retient le point le plus proche de la borne sans jamais la dépasser', () => {
    const accounts = june2026([
      lclPoint('2026-05-30', 900),
      lclPoint('2026-05-31', 1_000),
      lclPoint('2026-06-03', 1_050),
      lclPoint('2026-06-30', 1_200),
      lclPoint('2026-07-02', 1_250),
    ]);

    expect(accounts[0]).toMatchObject({ openingBalance: 1_000, closingBalance: 1_200 });
  });

  it('laisse la borne manquante quand le dernier point est trop ancien', () => {
    const accounts = june2026([lclPoint('2026-05-28', 1_000), lclPoint('2026-07-01', 1_200)]);

    expect(accounts[0]).toMatchObject({ openingBalance: null, closingBalance: 1_200 });
  });
});

describe('getMonthlySavingsBounds', () => {
  it("fait démarrer l'historique à charger quelques jours avant l'ouverture", () => {
    expect(getMonthlySavingsBounds('2026-06')).toEqual({
      historyStartDate: '2026-05-29',
      openingDate: '2026-06-01',
      closingDate: '2026-07-01',
    });
  });
});

describe('useMonthlySavingsPosition — cumul depuis janvier', () => {
  const lclPoint = (date: string, montant: number) => ({
    assetId: 'nicolas_courant_lcl',
    date,
    nom: 'LCL',
    montant,
    type: 'courants',
    owner: 'nicolas',
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    firestore.whereCalls = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('charge l’historique depuis janvier et cumule la capacité des mois écoulés', async () => {
    firestore.history = [
      lclPoint('2026-01-01', 1_000),
      lclPoint('2026-02-01', 1_100),
      lclPoint('2026-03-01', 1_250),
      lclPoint('2026-04-01', 1_250),
    ];

    const { result } = renderHook(() => useMonthlySavingsPosition('2026-03', []));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(firestore.whereCalls).toContainEqual(['date', '>=', '2025-12-29']);
    expect(firestore.whereCalls).toContainEqual(['date', '<=', '2026-04-01']);
    expect(result.current.position).toMatchObject({ month: '2026-03', savingsCapacity: 0 });
    expect(result.current.yearToDate).toEqual({
      fromMonth: '2026-01',
      toMonth: '2026-03',
      savingsCapacity: 250,
      netSavings: 0,
      unavailableMonths: [],
    });
  });

  it('signale les mois sans soldes et ne cumule rien', async () => {
    firestore.history = [
      lclPoint('2026-01-01', 1_000),
      lclPoint('2026-03-01', 1_250),
      lclPoint('2026-04-01', 1_250),
    ];

    const { result } = renderHook(() => useMonthlySavingsPosition('2026-03', []));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.yearToDate).toMatchObject({
      savingsCapacity: null,
      unavailableMonths: ['2026-01', '2026-02'],
    });
  });

  it('n’expose pas de cumul pendant le chargement', () => {
    firestore.history = [];
    const { result } = renderHook(() => useMonthlySavingsPosition('2026-03', []));

    expect(result.current.loading).toBe(true);
    expect(result.current.yearToDate).toBeNull();
  });
});
