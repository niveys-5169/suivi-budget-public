import { describe, it, expect } from 'vitest';
import {
  reconstitutePositionAtDate,
  holdingAssetId,
  buildPerHoldingDailySnapshots,
  type PortfolioTx,
} from '../../public/src/utils/portfolioReconstruction';
import { resolveHistoryAssetIds } from '../../public/src/utils/historyAssetResolver';

describe('portfolioReconstruction', () => {
  it('calcule correctement une position avec BUY et FEE_SHARES', () => {
    const txs: PortfolioTx[] = [
      {
        type: 'BUY',
        date: '2026-01-15',
        quantity: 10,
        amount: 1000,
        fees: 0,
        isin: 'FR001',
      },
      {
        type: 'FEE_SHARES',
        date: '2026-03-31',
        quantity: 0.05,
        amount: 5,
        fees: 0,
        isin: 'FR001',
      },
    ];

    const state = reconstitutePositionAtDate(txs);
    expect(state.quantity).toBeCloseTo(9.95, 4);
    // Le capital initial investi n'est pas modifié par les frais en parts
    expect(state.netInvested).toBe(1000);
    expect(state.costBasis).toBe(1000);
  });

  it('calcule correctement une vente partielle après des frais en parts', () => {
    const txs: PortfolioTx[] = [
      {
        type: 'BUY',
        date: '2026-01-15',
        quantity: 10,
        amount: 1000,
        fees: 0,
        isin: 'FR001',
      },
      {
        type: 'FEE_SHARES',
        date: '2026-03-31',
        quantity: 1,
        amount: 0,
        fees: 0,
        isin: 'FR001',
      },
      {
        type: 'SELL',
        date: '2026-06-30',
        quantity: 4.5,
        amount: 600,
        fees: 0,
        isin: 'FR001',
      },
    ];

    const state = reconstitutePositionAtDate(txs);
    expect(state.quantity).toBeCloseTo(4.5, 4);
    // Vente de 4.5 parts sur 9 restantes (50% du costBasis restant)
    expect(state.costBasis).toBeCloseTo(500, 2);
    expect(state.netInvested).toBeCloseTo(400, 2); // 1000 - 600
  });

  it('génère un holdingAssetId stable et canonique', () => {
    expect(holdingAssetId('FR001', 'Nicolas', 'AV')).toBe('portfolio_fr001_nicolas_av');
    expect(holdingAssetId('US0378331005', 'Romane', 'Linxea Spirit 2')).toBe(
      'portfolio_us0378331005_romane_linxea_spirit_2',
    );
  });

  it('reconstitue des snapshots quotidiens sur changement de valeur', () => {
    const txs: PortfolioTx[] = [
      {
        type: 'BUY',
        date: '2026-01-10',
        quantity: 10,
        amount: 500,
        fees: 0,
        isin: 'FR001',
        owner: 'Nicolas',
        envelope: 'PEA',
      },
    ];
    const priceHistory = {
      fr001: {
        '2026-01-10': 50,
        '2026-01-15': 55,
      },
    };

    const snaps = buildPerHoldingDailySnapshots(txs, priceHistory, { fr001: 'Amundi PEA' });
    expect(snaps.length).toBe(2);
    expect(snaps[0]?.montant).toBe(500);
    expect(snaps[1]?.montant).toBe(550);
    expect(snaps[0]?.assetId).toBe('portfolio_fr001_nicolas_pea');
  });
});

describe('historyAssetResolver avec contrats', () => {
  it('résout les positions associées à une enveloppe live par nom ou par envelope', () => {
    const history = [
      {
        assetId: 'portfolio_fr001_romane_av',
        date: '2026-02-01',
        montant: 1200,
        owner: 'Romane',
        envelope: 'AV',
      },
    ];

    const resolved = resolveHistoryAssetIds(
      {
        id: 'live_pf_acc_spirit_romane',
        name: 'Linxea Spirit 2 Romane',
        ownerId: 'romane',
        type: 'investissements',
        envelope: 'AV',
      },
      history,
    );

    expect(resolved.has('portfolio_fr001_romane_av')).toBe(true);
  });
});
