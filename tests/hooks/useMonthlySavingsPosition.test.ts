import { describe, expect, it } from 'vitest';
import { buildMonthlySavingsAccounts } from '../../public/src/hooks/useMonthlySavingsPosition';

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
});
