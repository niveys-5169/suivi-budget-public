import { courantAssetId, savingsAssetId } from './assetId';
import { holdingAssetId } from './portfolioReconstruction';

/** Forme minimale du mapping propriétaires consommée par les agrégats patrimoine. */
export interface OwnerMappingLike {
  accounts?: Record<string, string>;
  savings_patterns?: Record<string, string>;
  default_owner?: string;
}

/** Forme minimale d'un solde de compte / d'épargne. */
export interface BalanceLike {
  id?: string;
  compte?: string;
  owner?: string;
  current_balance?: number;
  solde?: number;
}

/** Forme minimale d'une position du portefeuille boursier. */
export interface HoldingLike {
  isin: string;
  name: string;
  ticker?: string;
  owner?: string;
  account?: string;
  currentValue: number;
}

/** Forme minimale d'un placement manuel. */
export interface PlacementLike {
  id: string;
  nom: string;
  type: string;
  owner: string;
  montant?: number;
}

export interface SnapshotAsset {
  id: string;
  nom: string;
  type: string;
  owner: string;
  montant: number;
}

/**
 * Résout le propriétaire d'un compte : propriétaire explicite, puis mapping direct,
 * puis (pour l'épargne) correspondance par motif, sinon propriétaire par défaut.
 */
export function resolveAssetOwner(
  compte: string,
  directOwner: string | undefined,
  isSavings: boolean,
  ownerMapping: OwnerMappingLike | null | undefined,
): string {
  if (directOwner) return directOwner;
  if (ownerMapping?.accounts?.[compte]) return ownerMapping.accounts[compte]!;
  if (isSavings) {
    const patterns = ownerMapping?.savings_patterns || {};
    if (patterns[compte]) return patterns[compte]!;
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
  return ownerMapping?.default_owner || 'Nicolas';
}

/**
 * Fusionne comptes courants, épargne et placements en une liste d'actifs dédoublonnée
 * par `id` (premier gagnant), pour alimenter le sélecteur d'instantané patrimoine.
 */
export function buildSnapshotOptions(
  accountBalances: BalanceLike[] | null | undefined,
  savingsBalances: BalanceLike[] | null | undefined,
  placements: PlacementLike[] | null | undefined,
  ownerMapping: OwnerMappingLike | null | undefined,
): SnapshotAsset[] {
  const combined: SnapshotAsset[] = [
    ...(accountBalances || []).map((b) => {
      const owner = resolveAssetOwner(b.compte || '', b.owner, false, ownerMapping);
      return {
        id: courantAssetId(owner, b.compte || ''),
        nom: b.compte || '',
        type: 'cash',
        owner,
        montant: Number(b.current_balance ?? b.solde ?? 0),
      };
    }),
    ...(savingsBalances || []).map((b) => {
      const owner = resolveAssetOwner(b.compte || '', b.owner, true, ownerMapping);
      return {
        id: savingsAssetId(owner, b.compte || ''),
        nom: b.compte || '',
        type: 'savings',
        owner,
        montant: Number(b.current_balance ?? b.solde ?? 0),
      };
    }),
    ...(placements || []).map((p) => ({
      id: p.id,
      nom: p.nom,
      type: p.type,
      owner: p.owner,
      montant: Number(p.montant ?? 0),
    })),
  ];

  const unique = new Map<string, SnapshotAsset>();
  for (const item of combined) {
    if (!unique.has(item.id)) {
      unique.set(item.id, item);
    }
  }
  return Array.from(unique.values());
}

export interface WealthTotals {
  courants: number;
  epargne: number;
  bourse: number;
  per: number;
  total: number;
}

/**
 * Totaux patrimoniaux : liquidités, épargne (livrets + placements manuels hors
 * retraite), bourse (valeur live du portefeuille), retraite (PER).
 * NB : `current_balance || solde` est volontaire (un solde courant à 0 retombe
 * sur l'ancien champ `solde`) — même convention dans les deux consommateurs.
 */
export function computeWealthTotals(
  accountBalances: BalanceLike[] | null | undefined,
  savingsBalances: BalanceLike[] | null | undefined,
  placements: PlacementLike[] | null | undefined,
  portfolioValue: number,
): WealthTotals {
  const courants = (accountBalances || []).reduce(
    (s, b) => s + (Number(b.current_balance || b.solde) || 0),
    0,
  );
  const epargnelivrets = (savingsBalances || []).reduce(
    (s, b) => s + (Number(b.current_balance || b.solde) || 0),
    0,
  );

  let per = 0;
  const epargneManuel = (placements || []).reduce((s, p) => {
    const t = (p.type || '').toLowerCase();
    if (t === 'per' || t === 'retirement') {
      per += Number(p.montant) || 0;
      return s;
    }
    return s + (Number(p.montant) || 0);
  }, 0);

  const epargne = epargnelivrets + epargneManuel;
  const total = courants + epargne + portfolioValue + per;

  return { courants, epargne, bourse: portfolioValue, per, total };
}

/**
 * Variante Aurum du sélecteur d'instantané : épargne + placements manuels +
 * positions du portefeuille (pas de comptes courants, propriétaire par défaut
 * « Commun » sans mapping), dédoublonnée par id (premier gagnant).
 */
export function buildAurumSnapshotOptions(
  savingsBalances: BalanceLike[] | null | undefined,
  placements: PlacementLike[] | null | undefined,
  holdings: HoldingLike[],
): SnapshotAsset[] {
  const combined: SnapshotAsset[] = [
    ...(savingsBalances || []).map((b) => {
      const owner = b.owner || 'Commun';
      return {
        id: savingsAssetId(owner, b.compte || ''),
        nom: b.compte || '',
        type: 'savings',
        owner,
        montant: Number(b.current_balance ?? b.solde ?? 0),
      };
    }),
    ...(placements || []).map((p) => ({
      id: p.id,
      nom: p.nom,
      type: p.type,
      owner: p.owner,
      montant: Number(p.montant),
    })),
    ...holdings.map((h) => ({
      id: holdingAssetId(h.isin, h.owner || 'default', h.account || 'default'),
      nom: `${h.name}${h.account ? ` — ${h.account}` : ''}`,
      type: 'portefeuille',
      owner: h.owner || 'Commun',
      montant: h.currentValue,
    })),
  ];

  const unique = new Map<string, SnapshotAsset>();
  for (const item of combined) {
    if (!unique.has(item.id)) {
      unique.set(item.id, item);
    }
  }
  return Array.from(unique.values());
}

/** Ligne du tableau « Détail des Actifs » (vue Aurum). */
export interface AurumAssetRow {
  id: string;
  nom: string;
  type: string;
  montant: number;
  owner: string;
}

/** Aplati comptes, épargne, placements et positions en lignes triées par montant décroissant. */
export function buildAurumAssetRows(
  accountBalances: BalanceLike[] | null | undefined,
  savingsBalances: BalanceLike[] | null | undefined,
  placements: PlacementLike[] | null | undefined,
  holdings: HoldingLike[],
): AurumAssetRow[] {
  return [
    ...(accountBalances || []).map((b) => ({
      id: b.id || '',
      nom: b.compte || '',
      type: 'courant',
      montant: b.current_balance ?? b.solde ?? 0,
      owner: b.owner || 'Commun',
    })),
    ...(savingsBalances || []).map((b) => ({
      id: b.id || '',
      nom: b.compte || '',
      type: 'épargne',
      montant: b.current_balance ?? b.solde ?? 0,
      owner: b.owner || 'Commun',
    })),
    ...(placements || []).map((p) => ({
      id: p.id,
      nom: p.nom,
      type: p.type,
      montant: p.montant ?? 0,
      owner: p.owner,
    })),
    ...holdings.map((h) => ({
      id: h.ticker || h.isin,
      nom: h.name,
      type: 'portefeuille',
      montant: h.currentValue,
      owner: h.owner || 'Portfolio',
    })),
  ].sort((a, b) => b.montant - a.montant);
}
