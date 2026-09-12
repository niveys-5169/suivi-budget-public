import type { OwnerMapping } from '../hooks/usePatrimoine';
import type { RawHistoryEntry } from './wealthTimeline';
import {
  canonicalPortfolioAssetId,
  courantAssetId,
  isPerPositionPortfolioId,
  savingsAssetId,
} from './wealthTimeline';
import { placementAssetId } from './assetId';
import { holdingAssetId, safeSegment } from './portfolioReconstruction';

/** Actif tel qu'exposé par useWealthAggregates.filteredAssets. */
export interface ResolvableAsset {
  id: string;
  name: string;
  ownerId: string;
  type: string;
}

/** Comparaison souple : minuscules, alphanum uniquement. */
function looseKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Résout l'ensemble des assetId de `placement_history` correspondant à un actif
 * de l'UI. Les ids UI (doc id de placement, `b.id||b.compte` pour les comptes,
 * `live_pf_{account}_{owner}` pour les enveloppes portefeuille) ne coïncident
 * pas toujours avec les ids canoniques de l'historique — on tente donc, dans
 * l'ordre : match exact, ids canoniques dérivés, ids legacy, match sur le nom.
 * Pour les enveloppes portefeuille, seuls des ids PAR POSITION sont émis
 * (jamais les agrégats), ce qui préserve la sémantique de makePortfolioDedup.
 */
export function resolveHistoryAssetIds(
  asset: ResolvableAsset,
  placementHistory: RawHistoryEntry[],
  _ownerMapping?: OwnerMapping,
): Set<string> {
  const result = new Set<string>();
  const historyIds = new Set<string>();
  const nomByCanonicalId = new Map<string, { nom: string; owner: string }>();

  for (const h of placementHistory || []) {
    const raw = h.assetId || h.placementId || '';
    if (!raw) continue;
    const id = canonicalPortfolioAssetId(raw);
    historyIds.add(id);
    if (!nomByCanonicalId.has(id)) {
      const entry = h as RawHistoryEntry & { nom?: string };
      nomByCanonicalId.set(id, { nom: String(entry.nom || ''), owner: String(h.owner || '') });
    }
  }

  const owner = asset.ownerId;
  const ownerKey = looseKey(owner);
  const nameKey = looseKey(asset.name);

  // 1. Match exact (placements manuels : assetId = doc id Firestore).
  if (historyIds.has(asset.id)) result.add(asset.id);

  // 2. Enveloppe portefeuille live → expansion vers les positions par titre.
  if (asset.id.startsWith('live_pf_')) {
    const suffix = `_${safeSegment(owner)}_${safeSegment(asset.name)}`;
    historyIds.forEach((id) => {
      if (isPerPositionPortfolioId(id) && id.endsWith(suffix)) result.add(id);
    });
    return result;
  }

  // 3. Ids canoniques dérivés selon le type.
  const candidates: string[] = [];
  if (asset.type === 'savings') candidates.push(savingsAssetId(owner, asset.name));
  if (asset.type === 'cash') candidates.push(courantAssetId(owner, asset.name));
  if (asset.type === 'investissements' || asset.type === 'retirement') {
    candidates.push(placementAssetId(owner, asset.name, asset.type));
  }
  for (const c of candidates) if (historyIds.has(c)) result.add(c);

  // 4. Ids legacy `livret_*` (avant le format {owner}_livret_{slug}) : match souple sur le nom.
  if (asset.type === 'savings') {
    historyIds.forEach((id) => {
      if (!id.startsWith('livret_')) return;
      const rest = looseKey(id.slice('livret_'.length));
      if (rest && (rest.includes(nameKey) || nameKey.includes(rest))) result.add(id);
    });
  }

  // 5. Fallback : entrées d'historique dont le nom correspond (même propriétaire ou owner absent).
  nomByCanonicalId.forEach(({ nom, owner: entryOwner }, id) => {
    if (result.has(id) || !nom) return;
    if (looseKey(nom) !== nameKey) return;
    if (entryOwner && looseKey(entryOwner) !== ownerKey) return;
    if (isPerPositionPortfolioId(id)) return; // les positions ne se résolvent que par holding/enveloppe
    result.add(id);
  });

  return result;
}

/** assetId d'historique d'une position boursière (table/liste portefeuille). */
export function resolveHoldingAssetId(h: { isin: string; owner: string; account: string }): string {
  return holdingAssetId(h.isin, h.owner, h.account);
}
