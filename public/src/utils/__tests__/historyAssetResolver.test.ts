import { describe, it, expect } from 'vitest';
import { resolveHistoryAssetIds, resolveHoldingAssetId } from '../historyAssetResolver';
import type { RawHistoryEntry } from '../wealthTimeline';

const history: RawHistoryEntry[] = [
  { assetId: 'DOC123', date: '2026-01-01', montant: 100 },
  { assetId: 'nicolas_livret_livret-a', date: '2026-01-01', montant: 200 },
  { assetId: 'livret_Livret_A__x328C_', date: '2025-06-01', montant: 190 },
  { assetId: 'nicolas_courant_bforbank', date: '2026-01-01', montant: 50 },
  { assetId: 'portfolio_fr0000000001_nicolas_pea', date: '2026-01-01', montant: 500 },
  { assetId: 'portfolio_fr0000000002_nicolas_pea', date: '2026-01-01', montant: 300 },
  { assetId: 'portfolio_fr0000000001_romane_cto', date: '2026-01-01', montant: 400 },
  { assetId: 'portefeuille_boursier', date: '2026-01-01', montant: 1200 },
  {
    assetId: 'orphan_entry',
    date: '2026-01-01',
    montant: 42,
    owner: 'Nicolas',
    nom: 'Vieux Compte',
  } as RawHistoryEntry,
];

describe('resolveHistoryAssetIds', () => {
  it('placement manuel : match exact sur le doc id', () => {
    const ids = resolveHistoryAssetIds(
      { id: 'DOC123', name: 'Immobilier Paris', ownerId: 'nicolas', type: 'investissements' },
      history,
    );
    expect(ids).toEqual(new Set(['DOC123']));
  });

  it('livret : id canonique + id legacy livret_* par match souple sur le nom', () => {
    const ids = resolveHistoryAssetIds(
      { id: 'Livret A (x328C)', name: 'Livret A (x328C)', ownerId: 'nicolas', type: 'savings' },
      history,
    );
    expect(ids.has('livret_Livret_A__x328C_')).toBe(true);
  });

  it('compte courant : id canonique dérivé', () => {
    const ids = resolveHistoryAssetIds(
      { id: 'BforBank', name: 'BforBank', ownerId: 'nicolas', type: 'cash' },
      history,
    );
    expect(ids).toEqual(new Set(['nicolas_courant_bforbank']));
  });

  it('enveloppe portefeuille : expansion vers les positions par titre, sans agrégats', () => {
    const ids = resolveHistoryAssetIds(
      { id: 'live_pf_pea_nicolas', name: 'PEA', ownerId: 'nicolas', type: 'investissements' },
      history,
    );
    expect(ids).toEqual(
      new Set(['portfolio_fr0000000001_nicolas_pea', 'portfolio_fr0000000002_nicolas_pea']),
    );
    expect(ids.has('portefeuille_boursier')).toBe(false);
    expect(ids.has('portfolio_fr0000000001_romane_cto')).toBe(false);
  });

  it('fallback : match sur le nom avec propriétaire cohérent', () => {
    const ids = resolveHistoryAssetIds(
      { id: 'unknown', name: 'Vieux Compte', ownerId: 'nicolas', type: 'cash' },
      history,
    );
    expect(ids.has('orphan_entry')).toBe(true);

    const wrongOwner = resolveHistoryAssetIds(
      { id: 'unknown', name: 'Vieux Compte', ownerId: 'romane', type: 'cash' },
      history,
    );
    expect(wrongOwner.has('orphan_entry')).toBe(false);
  });

  it('aucune correspondance → ensemble vide', () => {
    const ids = resolveHistoryAssetIds(
      { id: 'nope', name: 'Inconnu', ownerId: 'nicolas', type: 'cash' },
      history,
    );
    expect(ids.size).toBe(0);
  });
});

describe('resolveHoldingAssetId', () => {
  it('construit le même id que holdingAssetId (safeSegment)', () => {
    expect(resolveHoldingAssetId({ isin: 'FR0000000001', owner: 'Nicolas', account: 'PEA' })).toBe(
      'portfolio_fr0000000001_nicolas_pea',
    );
  });
});
