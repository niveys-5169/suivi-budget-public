import { describe, it, expect } from 'vitest';
import { buildWealthSummary } from '../../public/src/utils/wealthQAAnalysis';
import type { WealthSummaryInput } from '../../public/src/utils/wealthQAAnalysis';
import type { OwnerMapping, Placement } from '../../public/src/hooks/usePatrimoine';
import type { WealthHistoryEntry } from '../../public/src/types/patrimoine';
import type { SavingsBalance, AccountBalance } from '../../public/src/types/banking.types';

const ownerMapping: OwnerMapping = {
  owners: ['Nicolas', 'Romane'],
  accounts: {},
  savings_patterns: {},
  default_owner: 'Nicolas',
};

/** Date ISO il y a `days` jours, format YYYY-MM-DD. */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function makeInput(over: Partial<WealthSummaryInput> = {}): WealthSummaryInput {
  return {
    placements: [],
    savingsBalances: [],
    accountBalances: [],
    placementHistory: [],
    ownerMapping,
    ...over,
  };
}

describe('buildWealthSummary', () => {
  it('returns null when there is no patrimony data', () => {
    expect(buildWealthSummary(makeInput())).toBeNull();
  });

  it('ventilates current assets par owner et isole la retraite', () => {
    const placements: Placement[] = [
      { id: 'p1', nom: 'PER Nicolas', owner: 'Nicolas', type: 'per', montant: 10000 },
      { id: 'p2', nom: 'CTO Nicolas', owner: 'Nicolas', type: 'cto', montant: 5000 },
      { id: 'p3', nom: 'PER Romane', owner: 'Romane', type: 'retirement', montant: 3000 },
    ];
    const savingsBalances = [
      { id: 's1', compte: 'Livret A', owner: 'Romane', current_balance: 2000 } as SavingsBalance,
    ];
    const accountBalances = [
      {
        id: 'c1',
        compte: 'Compte courant',
        owner: 'Nicolas',
        current_balance: 800,
      } as AccountBalance,
    ];

    const summary = buildWealthSummary(makeInput({ placements, savingsBalances, accountBalances }));
    expect(summary).not.toBeNull();

    const nicolas = summary!.par_owner['Nicolas']!;
    expect(nicolas.actuel.retraite).toBe(10000);
    expect(nicolas.actuel.investissements).toBe(5000);
    expect(nicolas.actuel.courants).toBe(800);
    expect(nicolas.actuel.epargne).toBe(0);
    expect(nicolas.actuel.total).toBe(15800);

    const romane = summary!.par_owner['Romane']!;
    expect(romane.actuel.retraite).toBe(3000);
    expect(romane.actuel.epargne).toBe(2000);
    expect(romane.actuel.total).toBe(5000);

    // Global = somme des deux owners
    expect(summary!.global.actuel.total).toBe(20800);
    expect(summary!.global.actuel.retraite).toBe(13000);
  });

  it('computes 30-day evolution from history', () => {
    const placements: Placement[] = [
      { id: 'p1', nom: 'CTO', owner: 'Nicolas', type: 'cto', montant: 12000 },
    ];
    // État connu il y a 40 jours (≤ T-30j) : 10000 → évolution +2000 (+20%).
    const placementHistory: WealthHistoryEntry[] = [
      {
        assetId: 'p1',
        date: daysAgo(40),
        montant: 10000,
        owner: 'Nicolas',
        type: 'cto',
      },
    ];

    const summary = buildWealthSummary(makeInput({ placements, placementHistory }));
    const nicolas = summary!.par_owner['Nicolas']!;

    expect(nicolas.il_y_a_30j).not.toBeNull();
    expect(nicolas.il_y_a_30j!.total).toBe(10000);
    expect(nicolas.evolution).toEqual({ montant: 2000, pct: 20 });
  });

  it('leaves evolution null when history does not cover the period', () => {
    const placements: Placement[] = [
      { id: 'p1', nom: 'CTO', owner: 'Nicolas', type: 'cto', montant: 12000 },
    ];
    // Historique uniquement récent (après T-30j) : pas de base de comparaison.
    const placementHistory: WealthHistoryEntry[] = [
      { assetId: 'p1', date: daysAgo(5), montant: 11000, owner: 'Nicolas', type: 'cto' },
    ];

    const summary = buildWealthSummary(makeInput({ placements, placementHistory }));
    const nicolas = summary!.par_owner['Nicolas']!;
    expect(nicolas.il_y_a_30j).toBeNull();
    expect(nicolas.evolution).toBeNull();
  });

  it('falls back to portfolioValue when no live holdings and no market placements', () => {
    const summary = buildWealthSummary(makeInput({ portfolioValue: 7000 }));
    expect(summary!.par_owner['Nicolas']!.actuel.investissements).toBe(7000);
  });
});
