export type WealthCategory = 'courants' | 'epargne' | 'investissements' | 'retraite';

export { savingsAssetId, courantAssetId } from './assetId';

export interface WealthPoint {
  date: string;
  fullDate: string;
  timestamp: number;
  amount: number;
  byCat: Record<WealthCategory, number>;
}

export interface RawHistoryEntry {
  assetId?: string;
  placementId?: string;
  id?: string;
  date: string;
  montant?: number | string;
  amount?: number | string;
  value?: number | string;
  type?: string;
  owner?: string;
}

export function normalizeType(type: string): WealthCategory {
  const t = (type || '').toLowerCase().trim();
  if (['cash', 'courants', 'liquidités', 'liquidites', 'courant'].includes(t)) return 'courants';
  if (['savings', 'épargne', 'epargne', 'livret'].includes(t)) return 'epargne';
  if (['retirement', 'per', 'retraite'].includes(t)) return 'retraite';
  return 'investissements';
}

// --- Dédup du portefeuille titres ---------------------------------------------
// Le portefeuille boursier existe dans `placement_history` sous plusieurs formes
// concurrentes ; sommer ces formes ensemble gonfle artificiellement le patrimoine :
//   - positions par titre   `portfolio_{isin}_{owner}_{envelope}` (réparties par
//     propriétaire) — source de vérité ;
//   - agrégat quotidien      `portefeuille_boursier` (cron, tout le foyer sous un owner) ;
//   - agrégats legacy        `portfolio_global` et backfill mensuel `portfolio_bkfill_{YYYY-MM}`.
// Le backfill mensuel est piégeux : chaque mois porte un assetId distinct, donc dans une
// agrégation fill-forward par assetId tous les mois cohabitent et s'additionnent (≈ N × valeur).

/** Id canonique unique pour la série legacy `portfolio_bkfill_{YYYY-MM}` (sinon chaque mois s'additionne). */
const PORTFOLIO_BKFILL_ID = 'portfolio_bkfill';

/** Agrégats portefeuille, par ordre de préférence quand aucune position par titre n'existe. */
const PORTFOLIO_AGGREGATE_PRIORITY = [
  'portefeuille_boursier',
  'portfolio_global',
  PORTFOLIO_BKFILL_ID,
];
const PORTFOLIO_AGGREGATE_IDS = new Set(PORTFOLIO_AGGREGATE_PRIORITY);

/** Ramène les agrégats backfill mensuels `portfolio_bkfill_*` à un seul id logique. */
export function canonicalPortfolioAssetId(id: string): string {
  return id.startsWith('portfolio_bkfill') ? PORTFOLIO_BKFILL_ID : id;
}

/** Vrai pour toute forme AGRÉGÉE du portefeuille (à ignorer dès qu'il existe des positions). */
export function isPortfolioAggregateId(id: string): boolean {
  return PORTFOLIO_AGGREGATE_IDS.has(canonicalPortfolioAssetId(id));
}

/** Vrai pour une VRAIE position par titre `portfolio_{isin}_{owner}_{envelope}`. */
export function isPerPositionPortfolioId(id: string): boolean {
  return id.startsWith('portfolio_') && !isPortfolioAggregateId(id);
}

/**
 * Construit, à partir des assetId présents, un prédicat « cet assetId doit-il être
 * ignoré ? » qui garantit qu'une seule représentation du portefeuille est comptée.
 * Priorité : positions par titre > agrégat quotidien > agrégats legacy.
 * Les ids déjà canonicalisés ou bruts sont acceptés.
 */
export function makePortfolioDedup(presentIds: Iterable<string>): (id: string) => boolean {
  const ids = new Set<string>();
  for (const raw of presentIds) ids.add(canonicalPortfolioAssetId(raw));

  const hasPositions = [...ids].some(isPerPositionPortfolioId);
  const keptAggregate = hasPositions
    ? null
    : (PORTFOLIO_AGGREGATE_PRIORITY.find((id) => ids.has(id)) ?? null);

  return (rawId: string): boolean => {
    const id = canonicalPortfolioAssetId(rawId);
    if (!isPortfolioAggregateId(id)) return false; // positions & actifs non-portefeuille : jamais ignorés
    if (hasPositions) return true; // les positions font foi → tous les agrégats sont ignorés
    return id !== keptAggregate; // sinon on ne conserve qu'un seul agrégat
  };
}

/**
 * Pour les livrets, un assetId court est "legacy" si un assetId plus long avec le même
 * préfixe existe (ex: livret_Livret_A est legacy quand livret_Livret_A__x328C_ existe).
 * Cela se produit quand Linxo renomme un compte en ajoutant un identifiant entre parenthèses.
 * La déduplication s'active naturellement dès l'apparition du nouvel ID dans latestByAsset.
 */
export function makeSavingsDedup(presentIds: Iterable<string>): (id: string) => boolean {
  const livretIds = new Set([...presentIds].filter((id) => id.startsWith('livret_')));
  const staleIds = new Set<string>();
  for (const id of livretIds) {
    for (const other of livretIds) {
      if (other !== id && other.startsWith(id + '_')) {
        staleIds.add(id);
        break;
      }
    }
  }
  return (id: string) => staleIds.has(id);
}

export interface WealthTimelineOptions {
  /** Filtre sur l'owner STOCKÉ (insensible à la casse). Vide/undefined => tous. */
  ownerFilter?: string[];
}

/**
 * Builds a correct wealth timeline from placement_history entries.
 * For each unique date, computes the total as the sum of the latest
 * known value of each placement ID up to that date (fill-forward).
 * This avoids the naive sum-by-date bug where partial-day snapshots
 * under-represent the true total.
 */
export function buildWealthTimeline(
  history: RawHistoryEntry[],
  options?: WealthTimelineOptions,
): WealthPoint[] {
  if (!history?.length) return [];

  const sorted = [...history].filter((h) => h?.date).sort((a, b) => a.date.localeCompare(b.date));

  const uniqueDates = [...new Set(sorted.map((h) => h.date))].sort();

  // Map: assetId → { montant, type, owner }
  const lastKnown = new Map<string, { montant: number; type: string; owner: string }>();

  const points: WealthPoint[] = [];
  const selectedOwners = options?.ownerFilter?.map((o) => o.toLowerCase()) || [];

  for (const date of uniqueDates) {
    const entriesForDate = sorted.filter((h) => h.date === date);
    for (const h of entriesForDate) {
      // assetId is the canonical field; fall back to placementId for old docs.
      // Canonicalise pour que les backfill mensuels `portfolio_bkfill_*` ne s'additionnent pas.
      const rawPid = h.assetId || h.placementId || '';
      if (!rawPid) continue;
      const pid = canonicalPortfolioAssetId(rawPid);
      const amountVal = Number(h.montant ?? h.amount ?? h.value) || 0;
      const owner = (h.owner || '').trim();

      // Si un filtre est actif, on ne met à jour lastKnown que si l'owner correspond.
      // Cela permet d'isoler les séries temporelles par propriétaire.
      if (selectedOwners.length > 0) {
        if (!owner || !selectedOwners.includes(owner.toLowerCase())) {
          // Important: on ne SUPPRIME PAS lastKnown pour cet id s'il existait déjà pour un autre owner.
          // En pratique, un assetId est lié à un seul owner. Mais s'il change, le filtre
          // capturera la transition proprement.
          continue;
        }
      }

      lastKnown.set(pid, { montant: amountVal, type: h.type || '', owner });
    }

    const byCat: Record<WealthCategory, number> = {
      courants: 0,
      epargne: 0,
      investissements: 0,
      retraite: 0,
    };

    // Déduplications (portefeuille & livrets)
    const skipPortfolio = makePortfolioDedup(lastKnown.keys());
    const skipSavings = makeSavingsDedup(lastKnown.keys());

    let total = 0;
    for (const [assetId, { montant, type, owner }] of lastKnown) {
      if (skipPortfolio(assetId) || skipSavings(assetId)) continue;

      // Double vérification pour l'owner (nécessaire pour le fill-forward filtré)
      if (selectedOwners.length > 0) {
        if (!owner || !selectedOwners.includes(owner.toLowerCase())) {
          continue;
        }
      }

      const cat = normalizeType(type);
      byCat[cat] += montant;
      total += montant;
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) continue;

    points.push({
      date: dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      fullDate: dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      timestamp: dateObj.getTime(),
      amount: total,
      byCat,
    });
  }

  return points;
}
