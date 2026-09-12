export interface MonthlyBreakdown {
  monthKey: string;
  label: string;
  total: number;
  byCategory: Record<string, number>;
}

export interface CategoryTrend {
  category: string;
  current: number;
  previous: number;
  deltaPct: number | null;
}

interface TxLike {
  categorie?: string;
  category?: string;
  montant?: number;
  amount?: number;
  moisAffectation?: string;
  date?: string;
}

function getPrevMonths(fromMonthKey: string, n: number): string[] {
  const [year = NaN, month = NaN] = fromMonthKey.split('-').map(Number);
  const months: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(year, month - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months.reverse();
}

function monthLabel(monthKey: string): string {
  const [y = NaN, m = NaN] = monthKey.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('fr-FR', { month: 'short' });
}

export function computeSpendingTrends(
  transactions: TxLike[],
  months: number,
  currentMonthKey: string,
): { breakdown: MonthlyBreakdown[]; trends: CategoryTrend[]; topIncreases: CategoryTrend[] } {
  const targetMonths = getPrevMonths(currentMonthKey, months);

  const breakdownMap = new Map<string, MonthlyBreakdown>();
  for (const mk of targetMonths) {
    breakdownMap.set(mk, { monthKey: mk, label: monthLabel(mk), total: 0, byCategory: {} });
  }

  for (const tx of transactions) {
    const montant = tx.montant ?? 0;
    if (montant >= 0) continue; // expenses only
    const mk = (tx.moisAffectation || tx.date || '').slice(0, 7);
    if (!breakdownMap.has(mk)) continue;
    const cat = tx.categorie || 'Autres';
    const amount = Math.abs(montant);
    const entry = breakdownMap.get(mk)!;
    entry.total += amount;
    entry.byCategory[cat] = (entry.byCategory[cat] ?? 0) + amount;
  }

  const breakdown = targetMonths.map((mk) => breakdownMap.get(mk)!);

  // Compute trends: last full month vs. the one before
  const lastTwo = breakdown.slice(-2);
  const current = lastTwo[1]?.byCategory ?? {};
  const previous = lastTwo[0]?.byCategory ?? {};

  const allCats = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const trends: CategoryTrend[] = [];

  for (const cat of allCats) {
    const cur = current[cat] ?? 0;
    const prev = previous[cat] ?? 0;
    const deltaPct = prev > 0 ? ((cur - prev) / prev) * 100 : null;
    if (cur > 0 || prev > 0) {
      trends.push({ category: cat, current: cur, previous: prev, deltaPct });
    }
  }

  trends.sort((a, b) => b.current - a.current);

  const topIncreases = trends
    .filter((t) => t.deltaPct !== null && t.deltaPct > 0)
    .sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))
    .slice(0, 3);

  return { breakdown, trends, topIncreases };
}
