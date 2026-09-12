import { describe, it, expect } from 'vitest';
import {
  resolveAssetOwner,
  buildSnapshotOptions,
  computeWealthTotals,
  buildAurumSnapshotOptions,
  buildAurumAssetRows,
  type OwnerMappingLike,
  type HoldingLike,
} from '../../public/src/utils/wealthSnapshot';

describe('resolveAssetOwner', () => {
  const mapping: OwnerMappingLike = {
    accounts: { LCL: 'Nicolas' },
    savings_patterns: { 'Livret A': 'Romane' },
    default_owner: 'Nicolas',
  };

  it('prefers an explicit direct owner', () => {
    expect(resolveAssetOwner('LCL', 'Romane', false, mapping)).toBe('Romane');
  });

  it('resolves via the direct account mapping', () => {
    expect(resolveAssetOwner('LCL', undefined, false, mapping)).toBe('Nicolas');
  });

  it('matches a savings account exactly by pattern', () => {
    expect(resolveAssetOwner('Livret A', undefined, true, mapping)).toBe('Romane');
  });

  it('matches a savings account by fuzzy (substring) pattern', () => {
    expect(resolveAssetOwner('Livret A Boursorama', undefined, true, mapping)).toBe('Romane');
  });

  it('does not apply savings patterns to non-savings accounts', () => {
    expect(resolveAssetOwner('Livret A', undefined, false, mapping)).toBe('Nicolas');
  });

  it('falls back to the default owner, then to Nicolas', () => {
    expect(resolveAssetOwner('Inconnu', undefined, false, { default_owner: 'Romane' })).toBe(
      'Romane',
    );
    expect(resolveAssetOwner('Inconnu', undefined, false, null)).toBe('Nicolas');
  });
});

describe('buildSnapshotOptions', () => {
  it('builds cash, savings and placement assets with resolved owners', () => {
    const assets = buildSnapshotOptions(
      [{ compte: 'LCL', current_balance: 1000 }],
      [{ compte: 'Livret A', current_balance: 500 }],
      [{ id: 'p1', nom: 'PEA', type: 'investissements', owner: 'Nicolas', montant: 3000 }],
      { accounts: { LCL: 'Nicolas' }, savings_patterns: { 'Livret A': 'Romane' } },
    );
    expect(assets).toHaveLength(3);
    const cash = assets.find((a) => a.type === 'cash');
    expect(cash).toMatchObject({ nom: 'LCL', owner: 'Nicolas', montant: 1000 });
    expect(assets.find((a) => a.type === 'savings')).toMatchObject({
      owner: 'Romane',
      montant: 500,
    });
    expect(assets.find((a) => a.id === 'p1')).toMatchObject({ montant: 3000 });
  });

  it('falls back to solde then 0 for the amount', () => {
    const assets = buildSnapshotOptions(
      [{ compte: 'A', solde: 42 }, { compte: 'B' }],
      null,
      null,
      null,
    );
    expect(assets.find((a) => a.nom === 'A')!.montant).toBe(42);
    expect(assets.find((a) => a.nom === 'B')!.montant).toBe(0);
  });

  it('deduplicates by id (first occurrence wins)', () => {
    const assets = buildSnapshotOptions(
      [
        { compte: 'LCL', owner: 'Nicolas', current_balance: 100 },
        { compte: 'LCL', owner: 'Nicolas', current_balance: 999 },
      ],
      null,
      null,
      null,
    );
    expect(assets).toHaveLength(1);
    expect(assets[0]!.montant).toBe(100);
  });

  it('tolerates null / empty inputs', () => {
    expect(buildSnapshotOptions(null, null, null, null)).toEqual([]);
  });
});

const holding = (over: Partial<HoldingLike>): HoldingLike => ({
  isin: 'FR0000000001',
  name: 'ETF World',
  currentValue: 1500,
  ...over,
});

describe('computeWealthTotals', () => {
  it('splits balances, savings, manual placements, PER and portfolio value', () => {
    const totals = computeWealthTotals(
      [{ compte: 'LCL', current_balance: 1000 }],
      [{ compte: 'Livret A', current_balance: 500 }],
      [
        { id: 'p1', nom: 'Immo', type: 'immobilier', owner: 'Nicolas', montant: 2000 },
        { id: 'p2', nom: 'PER Nico', type: 'PER', owner: 'Nicolas', montant: 300 },
        { id: 'p3', nom: 'Retraite US', type: 'retirement', owner: 'Romane', montant: 200 },
      ],
      1500,
    );
    expect(totals).toEqual({
      courants: 1000,
      epargne: 2500, // 500 livrets + 2000 manuel (hors PER/retirement)
      bourse: 1500,
      per: 500,
      total: 5500,
    });
  });

  it('falls back current_balance → solde (a zero current_balance falls through to solde)', () => {
    const totals = computeWealthTotals(
      [
        { compte: 'A', current_balance: 0, solde: 80 },
        { compte: 'B', solde: 20 },
      ],
      null,
      null,
      0,
    );
    expect(totals.courants).toBe(100);
  });

  it('returns zeros on empty inputs', () => {
    expect(computeWealthTotals(null, null, null, 0)).toEqual({
      courants: 0,
      epargne: 0,
      bourse: 0,
      per: 0,
      total: 0,
    });
  });
});

describe('buildAurumSnapshotOptions', () => {
  it('combines savings, placements and holdings with Commun/default owners', () => {
    const assets = buildAurumSnapshotOptions(
      [{ compte: 'Livret A', current_balance: 500 }],
      [{ id: 'p1', nom: 'PEA', type: 'investissements', owner: 'Nicolas', montant: 3000 }],
      [holding({ account: 'PEA Bourso', owner: 'Nicolas' })],
    );
    expect(assets).toHaveLength(3);
    expect(assets.find((a) => a.type === 'savings')).toMatchObject({
      owner: 'Commun',
      montant: 500,
    });
    const pf = assets.find((a) => a.type === 'portefeuille')!;
    expect(pf.nom).toBe('ETF World — PEA Bourso');
    expect(pf.id).toBe('portfolio_fr0000000001_nicolas_pea_bourso');
    expect(pf.montant).toBe(1500);
  });

  it('deduplicates by id (first occurrence wins)', () => {
    const assets = buildAurumSnapshotOptions(
      null,
      [
        { id: 'dup', nom: 'A', type: 't', owner: 'o', montant: 1 },
        { id: 'dup', nom: 'B', type: 't', owner: 'o', montant: 2 },
      ],
      [],
    );
    expect(assets).toHaveLength(1);
    expect(assets[0]!.nom).toBe('A');
  });
});

describe('buildAurumAssetRows', () => {
  it('flattens the four sources and sorts by amount descending', () => {
    const rows = buildAurumAssetRows(
      [{ id: 'b1', compte: 'LCL', current_balance: 1000 }],
      [{ id: 's1', compte: 'Livret A', solde: 500 }],
      [{ id: 'p1', nom: 'Immo', type: 'immobilier', owner: 'Nicolas', montant: 2000 }],
      [holding({ ticker: 'CW8' })],
    );
    expect(rows.map((r) => r.id)).toEqual(['p1', 'CW8', 'b1', 's1']);
    expect(rows[0]!.montant).toBe(2000);
    expect(rows.find((r) => r.id === 'b1')).toMatchObject({ type: 'courant', owner: 'Commun' });
    expect(rows.find((r) => r.id === 's1')).toMatchObject({ type: 'épargne', montant: 500 });
    expect(rows.find((r) => r.id === 'CW8')).toMatchObject({
      type: 'portefeuille',
      owner: 'Portfolio',
    });
  });
});
