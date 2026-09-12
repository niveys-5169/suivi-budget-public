import type { OwnerMapping, Placement } from '../hooks/usePatrimoine';
import type { WealthHistoryEntry } from '../types/patrimoine';
import { savingsAssetId, courantAssetId } from './wealthTimeline';

export interface HistoryAsset {
  id: string;
  nom: string;
  type: string;
  owner: string;
}

interface BalanceLike {
  compte: string;
  owner?: string;
}

export const PORTFOLIO_ASSET_LABELS: Record<string, { nom: string; type: string; owner: string }> =
  {
    portfolio_global: {
      nom: 'Portefeuille (Suivi Portefeuille)',
      type: 'portefeuille',
      owner: 'Commun',
    },
  };

/** Résout le propriétaire d'un compte via mapping direct, patterns d'épargne, puis défaut. */
export function resolveAssetOwner(
  compte: string,
  directOwner: string | undefined,
  isSavings: boolean,
  ownerMapping: OwnerMapping | undefined,
): string {
  if (directOwner) return directOwner;
  if (ownerMapping?.accounts?.[compte]) return ownerMapping.accounts[compte];
  if (isSavings) {
    const patterns = ownerMapping?.savings_patterns || {};
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
  return ownerMapping?.default_owner || 'Nicolas';
}

interface BuildHistoryAssetsParams {
  placements: Placement[];
  savingsBalances: BalanceLike[];
  accountBalances: BalanceLike[] | undefined;
  placementHistory: WealthHistoryEntry[] | undefined;
  ownerMapping: OwnerMapping | undefined;
}

/**
 * Construit la liste dédupliquée des actifs gérables dans l'historique :
 * placements, livrets, comptes courants et actifs orphelins présents en historique.
 * Les entrées « Commun » sont écartées si une entrée nominative équivalente existe.
 */
export function buildHistoryAssets({
  placements,
  savingsBalances,
  accountBalances,
  placementHistory,
  ownerMapping,
}: BuildHistoryAssetsParams): HistoryAsset[] {
  const p: HistoryAsset[] = placements.map((item) => ({
    id: item.id,
    nom: item.nom,
    type: item.type,
    owner: item.owner || 'Commun',
  }));
  const s: HistoryAsset[] = savingsBalances.map((item) => {
    const owner = resolveAssetOwner(item.compte, item.owner, true, ownerMapping);
    return { id: savingsAssetId(owner, item.compte), nom: item.compte, type: 'savings', owner };
  });
  const c: HistoryAsset[] = (accountBalances || []).map((item) => {
    const owner = resolveAssetOwner(item.compte, item.owner, false, ownerMapping);
    return { id: courantAssetId(owner, item.compte), nom: item.compte, type: 'cash', owner };
  });

  const knownIds = new Set([...p, ...s, ...c].map((a) => a.id));
  const historyAssetIds: string[] = Array.from(
    new Set(
      (placementHistory || []).map((h) => h.assetId).filter((id): id is string => Boolean(id)),
    ),
  );
  const extra: HistoryAsset[] = historyAssetIds
    .filter((id) => !knownIds.has(id))
    .map((id) => {
      const label = PORTFOLIO_ASSET_LABELS[id];
      if (label) return { id, ...label };
      const sample = (placementHistory || []).find((h) => h.assetId === id);
      return {
        id,
        nom: (sample?.nom as string) || id,
        type: (sample?.type as string) || 'other',
        owner: (sample?.owner as string) || 'Commun',
      };
    });

  const allCombined = [...p, ...s, ...c, ...extra];

  // Deduplicate by ID, then by account name for old/new format mismatches
  // Prefer entries with owner !== "Commun"
  const uniqueAssetsMap = new Map<string, HistoryAsset>();
  for (const asset of allCombined) {
    const existing = uniqueAssetsMap.get(asset.id);
    if (!existing || (existing.owner === 'Commun' && asset.owner !== 'Commun')) {
      uniqueAssetsMap.set(asset.id, asset);
    }
  }

  // Second pass: filter out Commun entries that have a matching non-Commun entry
  // Match by account name, including fuzzy matching for old/new format differences
  const result = Array.from(uniqueAssetsMap.values());

  const extractAccountIdentifier = (nom: string, id: string): string => {
    // Extract unique identifier from account name or assetId
    // e.g., "Livret A (x328C)" or "Livret_A__x328C_" → "x328C"
    const match = nom.match(/\(([^)]+)\)/) || id.match(/([a-zA-Z0-9]+_)?([^_]+)$/);
    return match ? match[1] || match[0] : nom;
  };

  const filtered = result.filter((asset) => {
    if (asset.owner !== 'Commun') return true;
    // If this is a Commun entry, check if there's a non-Commun entry with matching account
    const assetId = extractAccountIdentifier(asset.nom, asset.id);
    const hasNonCommun = result.some((other) => {
      if (other.owner === 'Commun' || other.id === asset.id) return false;
      const otherId = extractAccountIdentifier(other.nom, other.id);
      return assetId === otherId || other.nom.includes(assetId) || asset.nom.includes(otherId);
    });
    return !hasNonCommun;
  });

  return filtered.sort((a, b) => a.nom.localeCompare(b.nom));
}
