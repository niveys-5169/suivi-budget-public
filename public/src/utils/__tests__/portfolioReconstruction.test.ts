import { describe, it, expect } from 'vitest';
import {
  buildPerHoldingDailySnapshots,
  holdingAssetId,
  type PortfolioTx,
  type PriceHistory,
} from '../portfolioReconstruction';

const ISIN = 'FR0000000001';
const isinKey = ISIN.toLowerCase();

function buyTx(date: string, quantity: number, amount: number): PortfolioTx {
  return { type: 'BUY', date, quantity, amount, isin: ISIN, ownerKey: 'nicolas', envelope: 'PEA' };
}

describe('buildPerHoldingDailySnapshots', () => {
  it('émet un point à chaque changement de NAV, déduplique les jours plats', () => {
    const txs = [buyTx('2026-01-01', 10, 1000)];
    const prices: PriceHistory = {
      [isinKey]: {
        '2026-01-01': 100, // valeur 1000
        '2026-01-02': 100, // inchangé → skip
        '2026-01-03': 110, // valeur 1100 → point
        '2026-01-04': 110, // inchangé → skip
      },
    };
    const snaps = buildPerHoldingDailySnapshots(txs, prices);
    const dates = snaps.map((s) => s.date);
    expect(dates).toEqual(['2026-01-01', '2026-01-03']);
    expect(snaps[0]!.montant).toBe(1000);
    expect(snaps[1]!.montant).toBe(1100);
  });

  it('utilise le bon assetId canonique (isin, owner, envelope)', () => {
    const snaps = buildPerHoldingDailySnapshots([buyTx('2026-01-01', 10, 1000)], {
      [isinKey]: { '2026-01-01': 100 },
    });
    expect(snaps[0]!.assetId).toBe(holdingAssetId(ISIN, 'nicolas', 'PEA'));
    expect(snaps[0]!.assetId).toBe('portfolio_fr0000000001_nicolas_pea');
  });

  it("génère un point lors d'un achat supplémentaire (changement de quantité)", () => {
    const txs = [buyTx('2026-01-01', 10, 1000), buyTx('2026-01-05', 5, 550)];
    const prices: PriceHistory = {
      [isinKey]: { '2026-01-01': 100, '2026-01-05': 110 },
    };
    const snaps = buildPerHoldingDailySnapshots(txs, prices);
    // 2026-01-01 : 10×100 = 1000 ; 2026-01-05 : 15×110 = 1650
    expect(snaps.map((s) => s.montant)).toEqual([1000, 1650]);
  });

  it('émet un point à 0 quand la position est soldée puis ignore la suite', () => {
    const txs: PortfolioTx[] = [
      buyTx('2026-01-01', 10, 1000),
      {
        type: 'SELL',
        date: '2026-02-01',
        quantity: 10,
        amount: 1200,
        isin: ISIN,
        ownerKey: 'nicolas',
        envelope: 'PEA',
      },
    ];
    const prices: PriceHistory = {
      [isinKey]: { '2026-01-01': 100, '2026-02-01': 120, '2026-03-01': 130 },
    };
    const snaps = buildPerHoldingDailySnapshots(txs, prices);
    const last = snaps[snaps.length - 1]!;
    expect(last.date).toBe('2026-02-01');
    expect(last.montant).toBe(0);
    // Pas de point après le solde.
    expect(snaps.filter((s) => s.date > '2026-02-01')).toHaveLength(0);
  });

  it('sans transactions → aucun snapshot', () => {
    expect(buildPerHoldingDailySnapshots([], {})).toEqual([]);
  });

  it('sépare les positions par propriétaire / enveloppe', () => {
    const txs: PortfolioTx[] = [
      {
        type: 'BUY',
        date: '2026-01-01',
        quantity: 10,
        amount: 1000,
        isin: ISIN,
        ownerKey: 'nicolas',
        envelope: 'PEA',
      },
      {
        type: 'BUY',
        date: '2026-01-01',
        quantity: 5,
        amount: 500,
        isin: ISIN,
        ownerKey: 'gwen',
        envelope: 'CTO',
      },
    ];
    const prices: PriceHistory = { [isinKey]: { '2026-01-01': 100 } };
    const snaps = buildPerHoldingDailySnapshots(txs, prices);
    const ids = new Set(snaps.map((s) => s.assetId));
    expect(ids).toContain(holdingAssetId(ISIN, 'nicolas', 'PEA'));
    expect(ids).toContain(holdingAssetId(ISIN, 'gwen', 'CTO'));
  });
});
