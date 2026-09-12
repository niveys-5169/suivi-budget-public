export interface PortfolioTx {
  type: string;
  date: string;
  quantity: number | string;
  amount: number | string;
  fees?: number | string;
  isin?: string;
  ownerKey?: string;
  owner?: string;
  envelope?: string;
  account?: string;
}

interface PositionState {
  quantity: number;
  netInvested: number;
  costBasis: number;
}

function reconstitutePositionAtDate(transactions: PortfolioTx[]): PositionState {
  let quantity = 0;
  let totalInvested = 0;
  let totalWithdrawn = 0;
  let costBasis = 0;

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  sorted.forEach((tx) => {
    const txType = String(tx.type || '')
      .trim()
      .toUpperCase();
    const txQty = Math.abs(Number(tx.quantity || 0));
    const txAmount = Math.abs(Number(tx.amount || 0));
    const txFees = Number(tx.fees || 0);

    if (txType === 'BUY' || txType === 'TRANSFER_IN') {
      quantity += txQty;
      const cost = txAmount + txFees;
      totalInvested += cost;
      costBasis += cost;
    } else if (txType === 'SELL' || txType === 'TRANSFER_OUT') {
      const avgCost = quantity > 0 ? costBasis / quantity : 0;
      const qtySold = Math.min(txQty, quantity);
      quantity -= qtySold;
      costBasis = Math.max(0, costBasis - avgCost * qtySold);
      totalWithdrawn += Math.max(0, txAmount - txFees);
    } else if (txType === 'DIVIDEND') {
      totalWithdrawn += txAmount;
    }
  });

  return { quantity, netInvested: totalInvested - totalWithdrawn, costBasis };
}

/** Prix historiques par ISIN : { [isin_lowercase]: { [YYYY-MM-DD]: nav } } */
export type PriceHistory = Record<string, Record<string, number>>;

/**
 * Retourne le NAV le plus récent disponible à une date donnée (ou avant).
 * Cherche le dernier prix connu sur ou avant targetDate.
 */
function getNavAtDate(priceHistory: PriceHistory, isin: string, targetDate: string): number {
  const isinKey = isin.toLowerCase();
  const prices = priceHistory[isinKey] || {};
  const dates = Object.keys(prices)
    .filter((d) => d <= targetDate)
    .sort();
  if (!dates.length) return 0;
  return prices[dates[dates.length - 1]!]!;
}

export interface MonthlySnapshot {
  date: string;
  monthKey: string;
  montant: number;
  netInvested: number;
}

export interface PerHoldingSnapshot {
  assetId: string;
  isin: string;
  owner: string;
  envelope: string;
  nom: string;
  date: string;
  monthKey: string;
  montant: number;
  netInvested: number;
}

/** Transforme un segment de string en identifiant safe pour Firestore */
export function safeSegment(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/** Construit l'assetId stable pour un triplet (isin, owner, envelope) */
export function holdingAssetId(isin: string, owner: string, envelope: string): string {
  return `portfolio_${safeSegment(isin)}_${safeSegment(owner)}_${safeSegment(envelope)}`;
}

/**
 * Reconstitue la valeur mensuelle du portefeuille à partir des transactions
 * et des prix historiques réels (NAV à chaque date de fin de mois).
 *
 * Pour chaque mois depuis la première transaction jusqu'à aujourd'hui :
 * 1. Reconstitue les quantités détenues par position (algo coût moyen pondéré)
 * 2. Cherche le NAV historique à cette date (dernière cotation disponible ≤ fin du mois)
 * 3. Calcule montant = Σ(quantité × navHistorique)
 *
 * Si aucun prix historique n'est disponible pour une position ce mois-là,
 * utilise netInvested comme fallback conservateur.
 */
export function buildMonthlyPortfolioSnapshots(
  allTransactions: PortfolioTx[],
  priceHistory: PriceHistory,
): MonthlySnapshot[] {
  if (!allTransactions.length) return [];

  const byPosition = new Map<string, PortfolioTx[]>();
  allTransactions.forEach((tx) => {
    const isin = (tx.isin || 'unknown').toLowerCase();
    const owner = (tx.ownerKey || tx.owner || 'default').toLowerCase();
    const envelope = (tx.envelope || tx.account || 'default').toLowerCase();
    const key = `${isin}||${owner}||${envelope}`;
    if (!byPosition.has(key)) byPosition.set(key, []);
    byPosition.get(key)!.push(tx);
  });

  const allDates = allTransactions
    .map((tx) => tx.date)
    .filter(Boolean)
    .sort();
  if (!allDates.length) return [];

  const firstMonth = allDates[0]!.substring(0, 7);
  const today = new Date();
  const todayMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const snapshots: MonthlySnapshot[] = [];
  const [yearStr, monthStr] = firstMonth.split('-');
  let year = Number(yearStr);
  let month = Number(monthStr);

  while (true) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    if (monthKey > todayMonthKey) break;

    const lastDay = new Date(year, month, 0);
    const lastDayStr = lastDay.toISOString().split('T')[0] ?? '';

    let totalValue = 0;
    let totalNetInvested = 0;
    let hasHistoricalPrice = false;

    byPosition.forEach((txs, key) => {
      const isin = key.split('||')[0] ?? '';
      const txsUpToMonth = txs.filter((tx) => tx.date <= lastDayStr);
      if (!txsUpToMonth.length) return;

      const state = reconstitutePositionAtDate(txsUpToMonth);
      if (state.quantity <= 0.0001) return;

      totalNetInvested += state.netInvested;

      const nav = getNavAtDate(priceHistory, isin, lastDayStr);
      if (nav > 0) {
        totalValue += state.quantity * nav;
        hasHistoricalPrice = true;
      } else {
        // Fallback : utilise le coût de base si pas de prix historique disponible
        totalValue += state.costBasis;
      }
    });

    if (totalNetInvested > 0) {
      snapshots.push({
        date: lastDayStr,
        monthKey,
        montant: hasHistoricalPrice
          ? Math.round(totalValue * 100) / 100
          : Math.round(totalNetInvested * 100) / 100,
        netInvested: Math.round(totalNetInvested * 100) / 100,
      });
    }

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return snapshots;
}

/**
 * Même logique que buildMonthlyPortfolioSnapshots, mais retourne une entrée par
 * triplet (isin, owner, envelope) et par mois, au lieu d'un agrégat global.
 * instrumentNames : { [isin_lowercase]: displayName }
 */
export function buildPerHoldingMonthlySnapshots(
  allTransactions: PortfolioTx[],
  priceHistory: PriceHistory,
  instrumentNames: Record<string, string> = {},
): PerHoldingSnapshot[] {
  if (!allTransactions.length) return [];

  const byPosition = new Map<string, PortfolioTx[]>();
  allTransactions.forEach((tx) => {
    const isin = (tx.isin || 'unknown').toLowerCase();
    const owner = (tx.ownerKey || tx.owner || 'default').toLowerCase();
    const envelope = (tx.envelope || tx.account || 'default').toLowerCase();
    const key = `${isin}||${owner}||${envelope}`;
    if (!byPosition.has(key)) byPosition.set(key, []);
    byPosition.get(key)!.push(tx);
  });

  const allDates = allTransactions
    .map((tx) => tx.date)
    .filter(Boolean)
    .sort();
  if (!allDates.length) return [];

  const firstMonth = allDates[0]!.substring(0, 7);
  const today = new Date();
  const todayMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const snapshots: PerHoldingSnapshot[] = [];
  const [yearStr, monthStr] = firstMonth.split('-');
  let year = Number(yearStr);
  let month = Number(monthStr);

  while (true) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    if (monthKey > todayMonthKey) break;

    const lastDay = new Date(year, month, 0);
    const lastDayStr = lastDay.toISOString().split('T')[0] ?? '';

    byPosition.forEach((txs, key) => {
      const [isin = '', owner = '', envelope = ''] = key.split('||');
      const txsUpToMonth = txs.filter((tx) => tx.date <= lastDayStr);
      if (!txsUpToMonth.length) return;

      const state = reconstitutePositionAtDate(txsUpToMonth);
      if (state.quantity <= 0.0001 && state.netInvested <= 0) return;

      const nav = getNavAtDate(priceHistory, isin, lastDayStr);
      const montant =
        nav > 0
          ? Math.round(state.quantity * nav * 100) / 100
          : Math.round(state.costBasis * 100) / 100;

      snapshots.push({
        assetId: holdingAssetId(isin, owner, envelope),
        isin,
        owner,
        envelope,
        nom: instrumentNames[isin] || isin.toUpperCase(),
        date: lastDayStr,
        monthKey,
        montant,
        netInvested: Math.round(state.netInvested * 100) / 100,
      });
    });

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return snapshots;
}

/**
 * Reconstruction QUOTIDIENNE par position (isin, owner, envelope), à partir des
 * transactions et des NAV journaliers réels (`instruments/{isin}/prices`).
 *
 * Pour maîtriser le volume Firestore sur tout l'historique, on n'émet un point
 * que les jours où la valeur d'une position CHANGE (variation de NAV ou de
 * quantité via achat/vente). Les jours intermédiaires sont reconstitués par
 * fill-forward côté timeline (`buildWealthTimeline`), donc la courbe reste
 * exacte avec un nombre d'écritures fortement réduit.
 *
 * Dates candidates = union des dates de transactions et des dates de cotation
 * connues pour les ISIN détenus (bornées à [1re transaction, aujourd'hui]).
 */
export function buildPerHoldingDailySnapshots(
  allTransactions: PortfolioTx[],
  priceHistory: PriceHistory,
  instrumentNames: Record<string, string> = {},
): PerHoldingSnapshot[] {
  if (!allTransactions.length) return [];

  const byPosition = new Map<string, PortfolioTx[]>();
  allTransactions.forEach((tx) => {
    const isin = (tx.isin || 'unknown').toLowerCase();
    const owner = (tx.ownerKey || tx.owner || 'default').toLowerCase();
    const envelope = (tx.envelope || tx.account || 'default').toLowerCase();
    const key = `${isin}||${owner}||${envelope}`;
    if (!byPosition.has(key)) byPosition.set(key, []);
    byPosition.get(key)!.push(tx);
  });

  const txDates = allTransactions
    .map((tx) => tx.date)
    .filter(Boolean)
    .sort();
  if (!txDates.length) return [];
  const firstDate = txDates[0]!;
  const todayStr = new Date().toISOString().split('T')[0]!;

  // Union des dates candidates : transactions + cotations des ISIN concernés.
  const heldIsins = new Set(
    [...byPosition.keys()].map((key) => key.split('||')[0] ?? '').filter(Boolean),
  );
  const candidateDates = new Set<string>(txDates);
  heldIsins.forEach((isin) => {
    const prices = priceHistory[isin.toLowerCase()];
    if (prices) Object.keys(prices).forEach((d) => candidateDates.add(d));
  });

  const dates = [...candidateDates].filter((d) => d >= firstDate && d <= todayStr).sort();

  const snapshots: PerHoldingSnapshot[] = [];
  // Dernier montant émis par position, pour ne conserver que les changements.
  const lastMontant = new Map<string, number>();

  for (const date of dates) {
    byPosition.forEach((txs, key) => {
      const [isin = '', owner = '', envelope = ''] = key.split('||');
      const txsUpToDate = txs.filter((tx) => tx.date <= date);
      if (!txsUpToDate.length) return;

      const state = reconstitutePositionAtDate(txsUpToDate);
      // Position soldée : on émet un dernier point à 0 puis on ignore les suivants.
      const closed = state.quantity <= 0.0001 && state.netInvested <= 0;

      const nav = getNavAtDate(priceHistory, isin, date);
      const montant = closed
        ? 0
        : nav > 0
          ? Math.round(state.quantity * nav * 100) / 100
          : Math.round(state.costBasis * 100) / 100;

      const prev = lastMontant.get(key);
      if (prev !== undefined && Math.abs(prev - montant) < 0.005) return; // inchangé → skip
      if (closed && prev === 0) return; // déjà soldée

      lastMontant.set(key, montant);
      snapshots.push({
        assetId: holdingAssetId(isin, owner, envelope),
        isin,
        owner,
        envelope,
        nom: instrumentNames[isin] || isin.toUpperCase(),
        date,
        monthKey: date.substring(0, 7),
        montant,
        netInvested: Math.round(state.netInvested * 100) / 100,
      });
    });
  }

  return snapshots;
}
