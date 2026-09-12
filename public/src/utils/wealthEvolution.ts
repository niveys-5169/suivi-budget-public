import type { RawHistoryEntry, WealthCategory, WealthPoint } from './wealthTimeline';
import { canonicalPortfolioAssetId } from './wealthTimeline';

export type EvolutionPeriod = '1M' | '3M' | '6M' | '1Y' | 'ytd' | 'all' | 'custom';

export interface PeriodRange {
  /** Date ISO (YYYY-MM-DD) de début, null = depuis toujours. */
  from: string | null;
  /** Date ISO (YYYY-MM-DD) de fin, null = jusqu'à aujourd'hui. */
  to: string | null;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/** Calcule la fenêtre [from, to] d'une période d'analyse. */
export function periodRangeISO(
  period: EvolutionPeriod,
  now: Date = new Date(),
  custom?: { from: string; to?: string },
): PeriodRange {
  switch (period) {
    case '1M':
    case '3M':
    case '6M': {
      const months = period === '1M' ? 1 : period === '3M' ? 3 : 6;
      const d = new Date(now);
      d.setMonth(d.getMonth() - months);
      return { from: toISODate(d), to: null };
    }
    case '1Y': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return { from: toISODate(d), to: null };
    }
    case 'ytd':
      return { from: `${now.getFullYear()}-01-01`, to: null };
    case 'custom':
      return { from: custom?.from || null, to: custom?.to || null };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

export interface CatEvolution {
  start: number;
  end: number;
  delta: number;
  /** null quand la valeur de départ est 0 (pas de % calculable). */
  deltaPct: number | null;
}

export interface WealthEvolution {
  startPoint: WealthPoint | null;
  endPoint: WealthPoint | null;
  total: CatEvolution;
  byCat: Record<WealthCategory, CatEvolution>;
  /** Points dans la fenêtre (startPoint inclus), pour sparkline. */
  points: WealthPoint[];
}

const CATEGORIES: WealthCategory[] = ['courants', 'epargne', 'investissements', 'retraite'];

/** Montants live par catégorie (même convention que WealthPoint.byCat). */
export type LiveByCat = Record<WealthCategory, number>;

/** Types internes de useWealthAggregates → catégories patrimoine. */
const SEGMENT_TYPE_TO_CAT: Record<string, WealthCategory> = {
  cash: 'courants',
  savings: 'epargne',
  investissements: 'investissements',
  retirement: 'retraite',
};

/** Convertit les segments live de useWealthAggregates en montants par catégorie. */
export function segmentsToLiveByCat(segments?: { type: string; amount: number }[]): LiveByCat {
  const byCat: LiveByCat = { courants: 0, epargne: 0, investissements: 0, retraite: 0 };
  (segments ?? []).forEach((s) => {
    const cat = SEGMENT_TYPE_TO_CAT[s.type];
    if (cat) byCat[cat] += s.amount || 0;
  });
  return byCat;
}

/**
 * Ajoute un point synthétique « maintenant » (valeurs live) en fin de timeline,
 * pour que la valeur de fin de l'évolution reflète l'état courant — identique
 * aux Allocations — plutôt que le dernier snapshot de placement_history.
 */
export function appendLiveTodayPoint(
  points: WealthPoint[],
  byCat: LiveByCat,
  now: Date = new Date(),
): WealthPoint[] {
  const amount = CATEGORIES.reduce((sum, c) => sum + (byCat[c] || 0), 0);
  const livePoint: WealthPoint = {
    date: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    fullDate: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    timestamp: now.getTime(),
    amount,
    byCat: { ...byCat },
  };
  return [...points, livePoint];
}

function makeCatEvolution(start: number, end: number): CatEvolution {
  const delta = end - start;
  return { start, end, delta, deltaPct: start !== 0 ? (delta / start) * 100 : null };
}

function midnightTs(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Évolution chiffrée sur une fenêtre [from, to].
 * Le point de départ est le DERNIER point connu avant ou à `from` (fill-forward,
 * même sémantique que le delta 30j de useWealthAggregates) ; à défaut, le premier
 * point de la fenêtre. `from` null => depuis le premier point.
 */
export function computeWealthEvolution(
  points: WealthPoint[],
  from: string | null,
  to?: string | null,
): WealthEvolution {
  const empty: CatEvolution = { start: 0, end: 0, delta: 0, deltaPct: null };
  const emptyByCat = Object.fromEntries(CATEGORIES.map((c) => [c, empty])) as Record<
    WealthCategory,
    CatEvolution
  >;
  if (!points.length) {
    return { startPoint: null, endPoint: null, total: empty, byCat: emptyByCat, points: [] };
  }

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const fromTs = from ? midnightTs(from) : null;
  const toTs = to ? midnightTs(to) : null;

  const upToEnd = toTs === null ? sorted : sorted.filter((p) => p.timestamp <= toTs);
  const endPoint = upToEnd.length ? upToEnd[upToEnd.length - 1]! : null;

  let startPoint: WealthPoint | null;
  if (fromTs === null) {
    startPoint = sorted[0]!;
  } else {
    const before = upToEnd.filter((p) => p.timestamp <= fromTs);
    startPoint = before.length ? before[before.length - 1]! : (upToEnd[0] ?? null);
  }

  if (!endPoint || !startPoint) {
    return { startPoint: null, endPoint: null, total: empty, byCat: emptyByCat, points: [] };
  }

  const windowPoints = upToEnd.filter((p) => p.timestamp >= startPoint!.timestamp);

  const byCat = Object.fromEntries(
    CATEGORIES.map((c) => [c, makeCatEvolution(startPoint!.byCat[c], endPoint.byCat[c])]),
  ) as Record<WealthCategory, CatEvolution>;

  return {
    startPoint,
    endPoint,
    total: makeCatEvolution(startPoint.amount, endPoint.amount),
    byCat,
    points: windowPoints,
  };
}

export interface AssetSeriesPoint {
  date: string;
  timestamp: number;
  value: number;
}

/**
 * Série temporelle d'un actif (ou d'un groupe d'actifs, ex: enveloppe portefeuille) :
 * une valeur par date, fill-forward par assetId, ids canonicalisés.
 */
export function buildAssetSeries(
  history: RawHistoryEntry[],
  assetIds: ReadonlySet<string>,
): AssetSeriesPoint[] {
  if (!history?.length || !assetIds.size) return [];

  const wanted = new Set<string>();
  assetIds.forEach((id) => wanted.add(canonicalPortfolioAssetId(id)));

  const entries = history
    .filter((h) => {
      if (!h?.date) return false;
      const raw = h.assetId || h.placementId || '';
      return raw ? wanted.has(canonicalPortfolioAssetId(raw)) : false;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) return [];

  const uniqueDates = [...new Set(entries.map((h) => h.date))];
  const lastKnown = new Map<string, number>();
  const points: AssetSeriesPoint[] = [];

  for (const date of uniqueDates) {
    for (const h of entries) {
      if (h.date !== date) continue;
      const pid = canonicalPortfolioAssetId(h.assetId || h.placementId || '');
      lastKnown.set(pid, Number(h.montant ?? h.amount ?? h.value) || 0);
    }
    const ts = new Date(date).getTime();
    if (isNaN(ts)) continue;
    let value = 0;
    lastKnown.forEach((v) => {
      value += v;
    });
    points.push({ date, timestamp: ts, value });
  }

  return points;
}

export interface AssetEvolution extends CatEvolution {
  points: AssetSeriesPoint[];
}

/** Évolution chiffrée d'un actif sur [from, to], même sémantique fill-forward que le global. */
export function computeAssetEvolution(
  series: AssetSeriesPoint[],
  from: string | null,
  to?: string | null,
): AssetEvolution {
  if (!series.length) return { start: 0, end: 0, delta: 0, deltaPct: null, points: [] };

  const sorted = [...series].sort((a, b) => a.timestamp - b.timestamp);
  const fromTs = from ? midnightTs(from) : null;
  const toTs = to ? midnightTs(to) : null;

  const upToEnd = toTs === null ? sorted : sorted.filter((p) => p.timestamp <= toTs);
  if (!upToEnd.length) return { start: 0, end: 0, delta: 0, deltaPct: null, points: [] };
  const endPoint = upToEnd[upToEnd.length - 1]!;

  let startPoint: AssetSeriesPoint;
  if (fromTs === null) {
    startPoint = upToEnd[0]!;
  } else {
    const before = upToEnd.filter((p) => p.timestamp <= fromTs);
    startPoint = before.length ? before[before.length - 1]! : upToEnd[0]!;
  }

  const points = upToEnd.filter((p) => p.timestamp >= startPoint.timestamp);
  return { ...makeCatEvolution(startPoint.value, endPoint.value), points };
}
