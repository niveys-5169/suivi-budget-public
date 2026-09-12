import { describe, it, expect } from 'vitest';
import {
  buildWealthTimeline,
  normalizeType,
  savingsAssetId,
  courantAssetId,
  canonicalPortfolioAssetId,
  isPortfolioAggregateId,
  isPerPositionPortfolioId,
  makePortfolioDedup,
} from '../../public/src/utils/wealthTimeline';

describe('normalizeType', () => {
  it('maps cash/courant variants to courants', () => {
    expect(normalizeType('cash')).toBe('courants');
    expect(normalizeType('courant')).toBe('courants');
    expect(normalizeType('courants')).toBe('courants');
    expect(normalizeType('Liquidités')).toBe('courants');
  });

  it('maps savings/épargne variants to epargne', () => {
    expect(normalizeType('savings')).toBe('epargne');
    expect(normalizeType('épargne')).toBe('epargne');
    expect(normalizeType('livret')).toBe('epargne');
  });

  it('maps retraite/PER to retraite', () => {
    expect(normalizeType('retraite')).toBe('retraite');
    expect(normalizeType('PER')).toBe('retraite');
  });

  it('defaults unknown types to investissements', () => {
    expect(normalizeType('pea')).toBe('investissements');
    expect(normalizeType('')).toBe('investissements');
    expect(normalizeType('unknown')).toBe('investissements');
  });
});

describe('savingsAssetId / courantAssetId', () => {
  it('prefixes with owner_livret_ and slugifies', () => {
    expect(savingsAssetId('nicolas', 'Livret A')).toBe('nicolas_livret_livret-a');
    expect(savingsAssetId('romane', 'LDD Commun')).toBe('romane_livret_ldd-commun');
  });

  it('prefixes with owner_courant_ and slugifies', () => {
    expect(courantAssetId('nicolas', 'Compte Joint')).toBe('nicolas_courant_compte-joint');
    expect(courantAssetId('nicolas', 'BNP#1')).toBe('nicolas_courant_bnp-1');
  });

  it('handles accents (Compte Chèques)', () => {
    expect(courantAssetId('nicolas', 'Compte Chèques')).toBe('nicolas_courant_compte-cheques');
  });
});

describe('buildWealthTimeline', () => {
  it('returns empty array for empty/null history', () => {
    expect(buildWealthTimeline([])).toEqual([]);
    expect(buildWealthTimeline(null as any)).toEqual([]);
  });

  it('builds a point for each unique date', () => {
    const history = [
      { assetId: 'livret_a', date: '2024-01-01', montant: 10000, type: 'epargne' },
      { assetId: 'pea_1', date: '2024-01-01', montant: 5000, type: 'pea' },
    ];
    const points = buildWealthTimeline(history);
    expect(points).toHaveLength(1);
    expect(points[0]!.amount).toBe(15000);
  });

  it('uses fill-forward: missing placement on later date keeps previous value', () => {
    const history = [
      { assetId: 'livret_a', date: '2024-01-01', montant: 10000, type: 'epargne' },
      { assetId: 'pea_1', date: '2024-01-01', montant: 5000, type: 'investissements' },
      // only pea updates on Feb 1; livret_a should carry forward
      { assetId: 'pea_1', date: '2024-02-01', montant: 5500, type: 'investissements' },
    ];
    const points = buildWealthTimeline(history);
    expect(points).toHaveLength(2);
    expect(points[1]!.amount).toBe(10000 + 5500);
  });

  it('splits amount by category in byCat', () => {
    const history = [
      { assetId: 'livret_a', date: '2024-01-01', montant: 8000, type: 'epargne' },
      { assetId: 'courant_1', date: '2024-01-01', montant: 2000, type: 'courant' },
    ];
    const point = buildWealthTimeline(history)[0]!;
    expect(point.byCat.epargne).toBe(8000);
    expect(point.byCat.courants).toBe(2000);
    expect(point.byCat.investissements).toBe(0);
  });

  it('returns points in chronological order', () => {
    const history = [
      { assetId: 'a1', date: '2024-03-01', montant: 300, type: 'epargne' },
      { assetId: 'a1', date: '2024-01-01', montant: 100, type: 'epargne' },
      { assetId: 'a1', date: '2024-02-01', montant: 200, type: 'epargne' },
    ];
    const points = buildWealthTimeline(history);
    expect(points).toHaveLength(3);
    expect(points[0]!.amount).toBe(100);
    expect(points[1]!.amount).toBe(200);
    expect(points[2]!.amount).toBe(300);
  });

  it('skips entries without a valid assetId', () => {
    const history = [
      { date: '2024-01-01', montant: 5000, type: 'epargne' }, // no assetId
      { assetId: 'livret_a', date: '2024-01-01', montant: 3000, type: 'epargne' },
    ];
    const point = buildWealthTimeline(history)[0]!;
    expect(point.amount).toBe(3000);
  });

  it('filters by owner using ownerFilter option', () => {
    const history = [
      {
        assetId: 'livret_a',
        date: '2024-01-01',
        montant: 10000,
        type: 'epargne',
        owner: 'Nicolas',
      },
      { assetId: 'pea_1', date: '2024-01-01', montant: 5000, type: 'pea', owner: 'Romane' },
    ];
    // Filter for Nicolas
    const pointsNic = buildWealthTimeline(history, { ownerFilter: ['Nicolas'] });
    expect(pointsNic[0]!.amount).toBe(10000);

    // Filter for Romane (case insensitive)
    const pointsRom = buildWealthTimeline(history, { ownerFilter: ['romane'] });
    expect(pointsRom[0]!.amount).toBe(5000);

    // Filter for both
    const pointsBoth = buildWealthTimeline(history, { ownerFilter: ['Nicolas', 'Romane'] });
    expect(pointsBoth[0]!.amount).toBe(15000);
  });

  it('handles fill-forward with owner filter correctly', () => {
    const history = [
      {
        assetId: 'livret_a',
        date: '2024-01-01',
        montant: 10000,
        type: 'epargne',
        owner: 'Nicolas',
      },
      {
        assetId: 'pea_1',
        date: '2024-01-01',
        montant: 5000,
        type: 'investissements',
        owner: 'Romane',
      },
      // Update Romane's asset, Nicolas's should carry forward
      {
        assetId: 'pea_1',
        date: '2024-02-01',
        montant: 6000,
        type: 'investissements',
        owner: 'Romane',
      },
    ];

    const pointsNic = buildWealthTimeline(history, { ownerFilter: ['Nicolas'] });
    expect(pointsNic).toHaveLength(2);
    expect(pointsNic[1]!.amount).toBe(10000);

    const pointsRom = buildWealthTimeline(history, { ownerFilter: ['Romane'] });
    expect(pointsRom).toHaveLength(2);
    expect(pointsRom[1]!.amount).toBe(6000);
  });

  it('deduplicates savings: ignores short IDs when a longer ID with same prefix exists', () => {
    const history = [
      { assetId: 'livret_Livret_A', date: '2024-01-01', montant: 1000, type: 'epargne' },
      // Later, Linxo adds a suffix
      { assetId: 'livret_Livret_A__x328C_', date: '2024-02-01', montant: 1100, type: 'epargne' },
    ];
    const points = buildWealthTimeline(history);
    expect(points).toHaveLength(2);
    expect(points[0]!.amount).toBe(1000);
    // On Feb 1st, livret_Livret_A should be ignored because livret_Livret_A__x328C_ exists
    expect(points[1]!.amount).toBe(1100);
  });
});

describe('portfolio asset id helpers', () => {
  it('canonicalises every monthly bkfill aggregate to a single id', () => {
    expect(canonicalPortfolioAssetId('portfolio_bkfill_2024-01')).toBe('portfolio_bkfill');
    expect(canonicalPortfolioAssetId('portfolio_bkfill_2024-12')).toBe('portfolio_bkfill');
    expect(canonicalPortfolioAssetId('portfolio_fr0000_nicolas_pea')).toBe(
      'portfolio_fr0000_nicolas_pea',
    );
  });

  it('classifies aggregate vs per-position portfolio ids', () => {
    expect(isPortfolioAggregateId('portefeuille_boursier')).toBe(true);
    expect(isPortfolioAggregateId('portfolio_global')).toBe(true);
    expect(isPortfolioAggregateId('portfolio_bkfill_2024-03')).toBe(true);
    expect(isPortfolioAggregateId('portfolio_fr0000_nicolas_pea')).toBe(false);

    expect(isPerPositionPortfolioId('portfolio_fr0000_nicolas_pea')).toBe(true);
    expect(isPerPositionPortfolioId('portfolio_bkfill_2024-03')).toBe(false);
    expect(isPerPositionPortfolioId('portefeuille_boursier')).toBe(false);
    expect(isPerPositionPortfolioId('livret_a')).toBe(false);
  });

  it('keeps positions and drops all aggregates when positions exist', () => {
    const skip = makePortfolioDedup([
      'portfolio_fr0000_nicolas_pea',
      'portefeuille_boursier',
      'portfolio_bkfill_2024-01',
      'livret_a',
    ]);
    expect(skip('portfolio_fr0000_nicolas_pea')).toBe(false);
    expect(skip('livret_a')).toBe(false);
    expect(skip('portefeuille_boursier')).toBe(true);
    expect(skip('portfolio_bkfill_2024-01')).toBe(true);
  });

  it('keeps a single aggregate (by priority) when no positions exist', () => {
    const skip = makePortfolioDedup(['portefeuille_boursier', 'portfolio_bkfill_2024-01']);
    expect(skip('portefeuille_boursier')).toBe(false);
    expect(skip('portfolio_bkfill_2024-01')).toBe(true);
  });
});

describe('buildWealthTimeline — portfolio deduplication', () => {
  it('does NOT sum monthly bkfill aggregates together (the ~204k spike bug)', () => {
    // 12 mensualités legacy `portfolio_bkfill_{YYYY-MM}`, chacune ~17k, même portefeuille.
    const history = Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, '0');
      return {
        assetId: `portfolio_bkfill_2024-${month}`,
        date: `2024-${month}-28`,
        montant: 17000,
        type: 'portefeuille',
      };
    });
    const points = buildWealthTimeline(history);
    // Avant le fix : le dernier point sommait les 12 mois = 204 000.
    // Après : fill-forward d'une seule série → ~17 000.
    expect(points[points.length - 1]!.amount).toBe(17000);
  });

  it('prefers per-position entries over the daily aggregate (no double count)', () => {
    const history = [
      // Positions par titre (source de vérité) : 10k + 7k = 17k
      {
        assetId: 'portfolio_fr01_nicolas_pea',
        date: '2024-02-01',
        montant: 10000,
        type: 'portefeuille',
      },
      {
        assetId: 'portfolio_fr02_gwen_cto',
        date: '2024-02-01',
        montant: 7000,
        type: 'portefeuille',
      },
      // Agrégat quotidien tout-foyer (doit être ignoré dès qu'il y a des positions)
      {
        assetId: 'portefeuille_boursier',
        date: '2024-02-01',
        montant: 17000,
        type: 'portefeuille',
      },
    ];
    const point = buildWealthTimeline(history)[0]!;
    expect(point.amount).toBe(17000);
    expect(point.byCat.investissements).toBe(17000);
  });

  it('falls back to the daily aggregate when no per-position entry exists', () => {
    const history = [
      {
        assetId: 'portefeuille_boursier',
        date: '2024-02-01',
        montant: 17000,
        type: 'portefeuille',
      },
      {
        assetId: 'portfolio_bkfill_2024-01',
        date: '2024-02-01',
        montant: 16000,
        type: 'portefeuille',
      },
    ];
    const point = buildWealthTimeline(history)[0]!;
    expect(point.amount).toBe(17000); // un seul agrégat, par priorité
  });
});
