import { describe, it, expect } from 'vitest';
import {
  resolveAssetOwner,
  buildHistoryAssets,
  PORTFOLIO_ASSET_LABELS,
} from '../../public/src/utils/historyAssets';
import type { OwnerMapping, Placement } from '../../public/src/hooks/usePatrimoine';
import type { WealthHistoryEntry } from '../../public/src/types/patrimoine';

const mapping = (over: Partial<OwnerMapping> = {}): OwnerMapping => ({
  owners: ['Nicolas', 'Romane'],
  accounts: {},
  savings_patterns: {},
  default_owner: 'Nicolas',
  ...over,
});

describe('resolveAssetOwner', () => {
  it('prefers an explicit direct owner', () => {
    expect(resolveAssetOwner('CCP', 'Romane', false, mapping())).toBe('Romane');
  });

  it('uses the accounts mapping', () => {
    expect(
      resolveAssetOwner('CCP', undefined, false, mapping({ accounts: { CCP: 'Romane' } })),
    ).toBe('Romane');
  });

  it('matches savings patterns (exact then fuzzy) only when isSavings', () => {
    const m = mapping({ savings_patterns: { livreta: 'Romane' } });
    expect(resolveAssetOwner('livreta', undefined, true, m)).toBe('Romane');
    // not savings → ignores patterns, falls back to default
    expect(resolveAssetOwner('livreta', undefined, false, m)).toBe('Nicolas');
  });

  it('falls back to default_owner then Nicolas', () => {
    expect(resolveAssetOwner('x', undefined, false, mapping({ default_owner: 'Gwen' }))).toBe(
      'Gwen',
    );
    expect(resolveAssetOwner('x', undefined, false, undefined)).toBe('Nicolas');
  });
});

describe('buildHistoryAssets', () => {
  const placement = (over: Partial<Placement>): Placement =>
    ({ id: 'p1', nom: 'PEA', type: 'pea', owner: 'Nicolas', montant: 1000, ...over }) as Placement;

  it('combines placements, savings and account balances, sorted by name', () => {
    const assets = buildHistoryAssets({
      placements: [placement({ id: 'p1', nom: 'Zeta PEA' })],
      savingsBalances: [{ compte: 'Alpha Livret', owner: 'Romane' }],
      accountBalances: [{ compte: 'Mid Compte', owner: 'Nicolas' }],
      placementHistory: [],
      ownerMapping: mapping(),
    });
    expect(assets.map((a) => a.nom)).toEqual(['Alpha Livret', 'Mid Compte', 'Zeta PEA']);
    expect(assets.find((a) => a.nom === 'Alpha Livret')?.type).toBe('savings');
    expect(assets.find((a) => a.nom === 'Mid Compte')?.type).toBe('cash');
  });

  it('adds orphan assets present only in history, using portfolio labels', () => {
    const history = [
      { assetId: 'portfolio_global', date: '2024-01-01', montant: 5000 },
    ] as unknown as WealthHistoryEntry[];
    const assets = buildHistoryAssets({
      placements: [],
      savingsBalances: [],
      accountBalances: [],
      placementHistory: history,
      ownerMapping: mapping(),
    });
    const orphan = assets.find((a) => a.id === 'portfolio_global');
    expect(orphan?.nom).toBe(PORTFOLIO_ASSET_LABELS.portfolio_global!.nom);
  });

  it('derives orphan metadata from a history sample when no label exists', () => {
    const history = [
      { assetId: 'mystery_1', nom: 'Mystery Fund', type: 'other', owner: 'Romane' },
    ] as unknown as WealthHistoryEntry[];
    const assets = buildHistoryAssets({
      placements: [],
      savingsBalances: [],
      accountBalances: [],
      placementHistory: history,
      ownerMapping: mapping(),
    });
    expect(assets[0]).toMatchObject({ id: 'mystery_1', nom: 'Mystery Fund', owner: 'Romane' });
  });

  it('prefers a non-Commun entry over a Commun one with the same id', () => {
    const assets = buildHistoryAssets({
      placements: [
        placement({ id: 'p1', nom: 'Shared', owner: 'Commun' }),
        placement({ id: 'p1', nom: 'Shared', owner: 'Nicolas' }),
      ],
      savingsBalances: [],
      accountBalances: [],
      placementHistory: [],
      ownerMapping: mapping(),
    });
    expect(assets).toHaveLength(1);
    expect(assets[0]!.owner).toBe('Nicolas');
  });
});
