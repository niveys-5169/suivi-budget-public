import type { Placement, OwnerMapping } from '../hooks/usePatrimoine';
import type { SavingsBalance, AccountBalance } from '../types/banking.types';
import type { WealthHistoryEntry } from '../types/patrimoine';
import type { Holding } from '../hooks/usePortfolio';
import { buildWealthTimeline, normalizeType, type WealthCategory } from './wealthTimeline';

/** Répartition d'un patrimoine sur les 4 segments d'audit (retraite isolée). */
export interface WealthBreakdown {
  courants: number;
  epargne: number;
  investissements: number;
  retraite: number;
  total: number;
}

export interface OwnerWealthSummary {
  actuel: WealthBreakdown;
  /** null si aucun historique ne remonte à ~30 jours. */
  il_y_a_30j: WealthBreakdown | null;
  /** null si pas de base de comparaison fiable. */
  evolution: { montant: number; pct: number } | null;
}

export interface WealthSummary {
  date_reference: string; // ISO YYYY-MM-DD (aujourd'hui)
  date_comparaison: string; // ISO YYYY-MM-DD (T-30j)
  par_owner: Record<string, OwnerWealthSummary>;
  global: OwnerWealthSummary;
  note: string;
}

export interface WealthSummaryInput {
  placements: Placement[];
  savingsBalances: SavingsBalance[];
  accountBalances: AccountBalance[];
  placementHistory: WealthHistoryEntry[];
  ownerMapping: OwnerMapping;
  /** Positions du portefeuille bourse live (optionnel : nécessite l'auth portefeuille). */
  holdings?: Holding[];
  /** Valeur agrégée du portefeuille (fallback quand les positions live ne sont pas chargées). */
  portfolioValue?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function emptyBreakdown(): WealthBreakdown {
  return { courants: 0, epargne: 0, investissements: 0, retraite: 0, total: 0 };
}

function addToBreakdown(b: WealthBreakdown, cat: WealthCategory, value: number): void {
  b[cat] += value;
  b.total += value;
}

// Résolution du propriétaire d'un solde — réplique la logique de useWealthAggregates
// (owner direct > mapping de compte > pattern d'épargne > propriétaire par défaut).
function resolveOwner(
  compte: string,
  directOwner: string | undefined,
  mapping: OwnerMapping,
  isSavings: boolean,
): string {
  if (directOwner) return directOwner;
  if (mapping.accounts[compte]) return mapping.accounts[compte];
  if (isSavings) {
    const patterns = mapping.savings_patterns || {};
    if (patterns[compte]) return patterns[compte];
    const compteLower = compte.toLowerCase();
    for (const [pattern, owner] of Object.entries(patterns)) {
      if (
        pattern.toLowerCase().includes(compteLower) ||
        compteLower.includes(pattern.toLowerCase())
      ) {
        return owner;
      }
    }
  }
  return mapping.default_owner || 'Nicolas';
}

/** Détecte une enveloppe retraite (PER) à partir de son nom de compte. */
function isRetirementEnvelope(accountName: string): boolean {
  const n = accountName.toLowerCase();
  return n.includes('per') || n.includes('retraite');
}

interface LiveAggregation {
  breakdowns: Record<string, WealthBreakdown>; // clé = owner en minuscule
  displayNames: Record<string, string>; // clé minuscule -> libellé affiché
}

/** Agrège les valeurs LIVE (placements + soldes + portefeuille) par propriétaire et par segment. */
function buildLiveByOwner(input: WealthSummaryInput): LiveAggregation {
  const defaultOwner = input.ownerMapping.default_owner || 'Nicolas';
  const breakdowns: Record<string, WealthBreakdown> = {};
  const displayNames: Record<string, string> = {};

  const register = (display: string, cat: WealthCategory, value: number) => {
    const key = display.toLowerCase();
    if (!breakdowns[key]) breakdowns[key] = emptyBreakdown();
    if (!displayNames[key]) displayNames[key] = display;
    addToBreakdown(breakdowns[key], cat, value);
  };

  for (const p of input.placements) {
    register(p.owner || defaultOwner, normalizeType(p.type), Number(p.montant) || 0);
  }
  for (const b of input.savingsBalances) {
    const compte = b.compte || b.id;
    register(
      resolveOwner(compte, b.owner, input.ownerMapping, true),
      'epargne',
      Number(b.current_balance || b.solde) || 0,
    );
  }
  for (const b of input.accountBalances || []) {
    const compte = b.compte || b.id;
    register(
      resolveOwner(compte, b.owner, input.ownerMapping, false),
      'courants',
      Number(b.current_balance || b.solde) || 0,
    );
  }
  const holdings = input.holdings || [];
  if (holdings.length > 0) {
    for (const h of holdings) {
      const accountName = h.account || 'Portefeuille Bourse';
      register(
        h.owner || defaultOwner,
        isRetirementEnvelope(accountName) ? 'retraite' : 'investissements',
        Number(h.currentValue) || 0,
      );
    }
  } else {
    // Fallback (parité useWealthAggregates) : sans positions live, on rattache la valeur
    // agrégée du portefeuille au propriétaire par défaut, sauf si des placements "marché"
    // manuels la couvrent déjà (sinon double comptage).
    const hasMarketPlacements = input.placements.some((p) =>
      ['cto', 'pea', 'assurance_vie', 'per'].includes((p.type || '').toLowerCase()),
    );
    if ((input.portfolioValue ?? 0) > 0 && !hasMarketPlacements) {
      register(defaultOwner, 'investissements', input.portfolioValue as number);
    }
  }

  return { breakdowns, displayNames };
}

/**
 * Reconstitue la répartition patrimoniale au plus tard à `cutoffTs`, à partir de
 * `placement_history` (réutilise buildWealthTimeline : fill-forward + déduplication).
 * `ownerFilter` undefined => tous les propriétaires.
 */
function historicalBreakdown(
  history: WealthHistoryEntry[],
  cutoffTs: number,
  ownerFilter?: string[],
): WealthBreakdown | null {
  const timeline = buildWealthTimeline(history, ownerFilter ? { ownerFilter } : undefined);
  const eligible = timeline.filter((p) => p.timestamp <= cutoffTs);
  if (!eligible.length) return null;
  const point = eligible[eligible.length - 1]!;
  return {
    courants: round2(point.byCat.courants ?? 0),
    epargne: round2(point.byCat.epargne ?? 0),
    investissements: round2(point.byCat.investissements ?? 0),
    retraite: round2(point.byCat.retraite ?? 0),
    total: round2(point.amount),
  };
}

function computeEvolution(
  actuel: WealthBreakdown,
  past: WealthBreakdown | null,
): { montant: number; pct: number } | null {
  if (!past || past.total <= 0) return null;
  const montant = round2(actuel.total - past.total);
  return { montant, pct: round2((montant / past.total) * 100) };
}

function roundBreakdown(b: WealthBreakdown): WealthBreakdown {
  return {
    courants: round2(b.courants),
    epargne: round2(b.epargne),
    investissements: round2(b.investissements),
    retraite: round2(b.retraite),
    total: round2(b.total),
  };
}

/**
 * Construit le résumé patrimonial fourni à l'IA : répartition actuelle vs ~30 jours,
 * par propriétaire et au global, avec les actifs de retraite isolés des autres.
 * Renvoie null si aucune donnée patrimoniale n'est disponible.
 */
export function buildWealthSummary(input: WealthSummaryInput): WealthSummary | null {
  const hasData =
    input.placements.length > 0 ||
    input.savingsBalances.length > 0 ||
    (input.accountBalances?.length ?? 0) > 0 ||
    (input.holdings?.length ?? 0) > 0 ||
    (input.portfolioValue ?? 0) > 0 ||
    input.placementHistory.length > 0;
  if (!hasData) return null;

  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffTs = cutoff.getTime();

  const live = buildLiveByOwner(input);

  // Union des propriétaires connus : mapping + ceux réellement présents dans les données live.
  const ownerNames: Record<string, string> = {};
  for (const name of input.ownerMapping.owners || []) ownerNames[name.toLowerCase()] = name;
  for (const [key, display] of Object.entries(live.displayNames)) {
    if (!ownerNames[key]) ownerNames[key] = display;
  }

  const par_owner: Record<string, OwnerWealthSummary> = {};
  for (const [key, display] of Object.entries(ownerNames)) {
    const actuel = roundBreakdown(live.breakdowns[key] || emptyBreakdown());
    const il_y_a_30j = historicalBreakdown(input.placementHistory, cutoffTs, [display]);
    par_owner[display] = { actuel, il_y_a_30j, evolution: computeEvolution(actuel, il_y_a_30j) };
  }

  const globalActuel = roundBreakdown(
    Object.values(live.breakdowns).reduce((acc, b) => {
      acc.courants += b.courants;
      acc.epargne += b.epargne;
      acc.investissements += b.investissements;
      acc.retraite += b.retraite;
      acc.total += b.total;
      return acc;
    }, emptyBreakdown()),
  );
  const globalPast = historicalBreakdown(input.placementHistory, cutoffTs);

  return {
    date_reference: now.toISOString().slice(0, 10),
    date_comparaison: cutoff.toISOString().slice(0, 10),
    par_owner,
    global: {
      actuel: globalActuel,
      il_y_a_30j: globalPast,
      evolution: computeEvolution(globalActuel, globalPast),
    },
    note:
      'Montants en euros. Segments : courants (comptes courants), epargne (livrets/épargne), ' +
      'investissements (CTO/PEA/assurance-vie/bourse), retraite (PER — actifs de retraite isolés). ' +
      "« il_y_a_30j » et « evolution » sont null lorsque l'historique ne couvre pas la période.",
  };
}
