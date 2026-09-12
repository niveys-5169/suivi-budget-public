import { diffInDays, formatMonthKey, parseDateInput, type DateInput } from './date';

function normalizeLabelTokens(label: string): string[] {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 2);
}

/** Jaccard similarity (0–1) between two transaction labels. */
export function computeLabelSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeLabelTokens(a));
  const tokensB = new Set(normalizeLabelTokens(b));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

export type TransactionLike = {
  id?: string;
  date?: string;
  montant?: number | string;
  categorie?: string;
  libelle?: string;
  compte?: string;
  importedAt?: DateInput;
};

export type MonthlyAggregation = {
  keys: string[];
  labels: string[];
  dep: number[];
  rec: number[];
  soldes: number[];
};

/**
 * Agrège les transactions par mois, sans dépendance au DOM ni à un état global.
 */
export function aggregateMonthlyTransactions(
  transactions: TransactionLike[],
  resolveMonthKey: (tx: TransactionLike) => string,
  locale = 'fr-FR',
): MonthlyAggregation {
  const map: Record<string, { dep: number; rec: number }> = {};

  for (const tx of transactions) {
    const monthKey = resolveMonthKey(tx);
    if (!monthKey) continue;

    const amount = Number(tx.montant || 0);
    if (!map[monthKey]) map[monthKey] = { dep: 0, rec: 0 };

    if (amount < 0) map[monthKey].dep += amount;
    else map[monthKey].rec += amount;
  }

  const keys = Object.keys(map).sort();
  const labels = keys.map((key) => formatMonthKey(key, locale));
  const dep = keys.map((key) => +Math.abs(map[key]!.dep).toFixed(2));
  const rec = keys.map((key) => +map[key]!.rec.toFixed(2));
  const soldes = keys.reduce<number[]>((acc, key) => {
    const previous = acc[acc.length - 1] ?? 0;
    acc.push(+(previous + map[key]!.dep + map[key]!.rec).toFixed(2));
    return acc;
  }, []);

  return { keys, labels, dep, rec, soldes };
}

export type RecurringItem = {
  label: string;
  category: string;
  compte?: string;
  avgAmount: number;
  freq: 'Hebdo' | 'Mensuel' | 'Trimestriel' | 'Semestriel' | 'Annuel';
  count: number;
  lastDate: string;
  avgInterval: number;
  periodMatchRatio: number;
};

/**
 * Détecte les dépenses récurrentes à partir d'un historique de transactions.
 */
export function detectRecurringTransactionsPure(
  transactions: TransactionLike[],
  expectedIntervals = [15, 30, 31, 60, 90, 180, 365],
  referenceDate: Date = new Date(),
): RecurringItem[] {
  const detectionWindowAgo = new Date(referenceDate);
  detectionWindowAgo.setDate(detectionWindowAgo.getDate() - 180);

  // Group 1: By Category and Account
  const byGroup: Record<string, TransactionLike[]> = {};
  for (const tx of transactions) {
    if (!tx?.date || !Number.isFinite(Number(tx?.montant))) continue;
    const amount = Number(tx.montant);
    if (amount === 0) continue;

    const category = String(tx.categorie || '(Sans catégorie)')
      .trim()
      .toLowerCase();
    const account = String(tx.compte || '').trim();
    const groupKey = `${category}||${account}`;

    if (!byGroup[groupKey]) byGroup[groupKey] = [];
    byGroup[groupKey].push(tx);
  }

  const allGroupedTransactions: TransactionLike[][] = [];

  for (const categoryTxs of Object.values(byGroup)) {
    // Pass 2: Group by label similarity
    const labelGroups: TransactionLike[][] = [];
    for (const tx of categoryTxs) {
      const txLabel = String(tx.libelle || '').trim();
      let foundLabelGroup = false;
      for (const group of labelGroups) {
        if (group.length === 0) continue;
        // Check similarity against all labels in the group
        let isSimilarToAnyInGroup = false;
        for (const existingTx of group) {
          if (computeLabelSimilarity(txLabel, String(existingTx.libelle || '').trim()) >= 0.6) {
            isSimilarToAnyInGroup = true;
            break;
          }
        }
        if (isSimilarToAnyInGroup) {
          group.push(tx);
          foundLabelGroup = true;
          break;
        }
      }
      if (!foundLabelGroup) {
        labelGroups.push([tx]);
      }
    }

    // Pass 3: For each label group, sub-group by amount variance
    for (const labelGroup of labelGroups) {
      const amountGroups: TransactionLike[][] = [];
      for (const tx of labelGroup) {
        const txAmount = Math.abs(Number(tx.montant));
        let foundAmountGroup = false;
        for (const group of amountGroups) {
          if (group.length === 0) continue;
          const groupAvgAmount =
            group.reduce((sum, t) => sum + Math.abs(Number(t.montant)), 0) / group.length;
          const amountLowerBound = groupAvgAmount * 0.8;
          const amountUpperBound = groupAvgAmount * 1.2;

          if (txAmount >= amountLowerBound && txAmount <= amountUpperBound) {
            group.push(tx);
            foundAmountGroup = true;
            break;
          }
        }
        if (!foundAmountGroup) {
          amountGroups.push([tx]);
        }
      }
      allGroupedTransactions.push(...amountGroups);
    }
  }
  const recurring: RecurringItem[] = [];

  for (const group of allGroupedTransactions) {
    // Temporal Filter: at least 3 occurrences in the last 180 days
    const recentTxs = group.filter((tx) => {
      const txDate = parseDateInput(tx.date || null);
      return txDate && txDate >= detectionWindowAgo;
    });

    if (recentTxs.length < 3) continue;

    const sorted = [...recentTxs].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (sorted.length < 3) continue; // Should be covered by recentTxs.length check, but for safety

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = parseDateInput(sorted[i - 1]!.date || null);
      const next = parseDateInput(sorted[i]!.date || null);
      if (!prev || !next) continue;
      const days = diffInDays(prev, next);
      if (days > 0) intervals.push(days);
    }

    // If there are less than 2 intervals, we can't reliably determine recurrence.
    // Example: 3 transactions yield 2 intervals. If we need at least 3 for a recurrence,
    // we need at least 2 intervals.
    if (intervals.length === 0) continue;

    let bestBase = 0;
    let bestMatches = 0;
    for (const base of expectedIntervals) {
      const matches = intervals.filter((days) => Math.abs(days - base) <= 3).length;
      if (matches > bestMatches) {
        bestMatches = matches;
        bestBase = base;
      }
    }

    const matchRatio = bestMatches / intervals.length;
    // Lower match ratio threshold slightly for more flexibility with new grouping
    if (!bestBase || bestMatches < 2 || matchRatio < 0.5) continue;

    let freq: RecurringItem['freq'] = 'Annuel';
    if (bestBase <= 45) freq = 'Mensuel';
    else if (bestBase <= 100) freq = 'Trimestriel';
    else if (bestBase <= 200) freq = 'Semestriel';

    const lastTx = sorted[sorted.length - 1]!;
    const avgAmount = sorted.reduce((sum, tx) => sum + Number(tx.montant || 0), 0) / sorted.length;

    const labelCounts: Record<string, number> = {};
    for (const tx of sorted) {
      const label = String(tx.libelle || '').trim();
      if (!label) continue;
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    }

    const displayLabel =
      Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      lastTx.libelle ||
      '(Sans libellé)';

    recurring.push({
      label: displayLabel,
      category: String(lastTx.categorie || '(Sans catégorie)')
        .trim()
        .toLowerCase(), // Ensure consistent category casing
      compte: lastTx.compte,
      avgAmount: +avgAmount.toFixed(2),
      freq,
      count: sorted.length,
      lastDate: String(lastTx.date || ''),
      avgInterval: bestBase,
      periodMatchRatio: matchRatio,
    });
  }
  recurring.sort((a, b) => Math.abs(b.avgAmount) - Math.abs(a.avgAmount));
  return recurring;
}
