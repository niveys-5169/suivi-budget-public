/**
 * Migration du backup JSON patrimoine vers le schéma d'assetId canonique {owner}_{type}_{slug}.
 *
 * Utilisation :
 *   1. Déclencher le reset (qui télécharge un backup JSON)
 *   2. Passer le backup JSON à migrateBackupJson()
 *   3. Le JSON migré peut être inspecté puis réimporté dans Firestore
 *
 * Règles :
 *   - portfolio_* : inchangé (déjà cohérent)
 *   - assetId déjà au format owner_type_slug : skip (idempotent)
 *   - savings_balances, account_balances : nouveau ID depuis owner + compte
 *   - placements (auto-ID Firestore) : nouveau ID depuis owner + nom + type
 *   - placement_history : assetId recalculé selon le type de l'entrée
 */

import { courantAssetId, savingsAssetId, placementAssetId, isCanonicalAssetId } from './assetId';
import { withRetry } from './withRetry';

export interface BackupDoc {
  id: string;
  [key: string]: unknown;
}

export interface PatrimoineBackup {
  exportedAt: string;
  collections: {
    placement_history?: BackupDoc[];
    placements?: BackupDoc[];
    savings_balances?: BackupDoc[];
    account_balances?: BackupDoc[];
    patrimoine_snapshots?: BackupDoc[];
    [key: string]: BackupDoc[] | undefined;
  };
}

export interface OwnersMapping {
  default_owner: string;
  accounts?: Record<string, string>;
  savings_patterns?: Record<string, string>;
}

export interface MigrationSummary {
  migrated: number;
  skipped: number;
  byCollection: Record<string, { migrated: number; skipped: number }>;
}

function resolveOwnerForAccount(compte: string, mapping: OwnersMapping): string {
  return (mapping.accounts?.[compte] ?? mapping.default_owner).toLowerCase();
}

function resolveOwnerForSavings(compte: string, mapping: OwnersMapping): string {
  const patterns = mapping.savings_patterns ?? {};
  for (const [pattern, owner] of Object.entries(patterns)) {
    if (compte.toLowerCase().includes(pattern.toLowerCase())) return owner.toLowerCase();
  }
  return mapping.default_owner.toLowerCase();
}

/**
 * Migre un backup JSON patrimoine vers des assetIds lisibles.
 * Retourne { backup migré, résumé }.
 */
export function migrateBackupJson(
  raw: PatrimoineBackup,
  mapping: OwnersMapping,
): { backup: PatrimoineBackup; summary: MigrationSummary } {
  const summary: MigrationSummary = { migrated: 0, skipped: 0, byCollection: {} };

  // Table de correspondance oldAssetId → newAssetId, pour réécrire placement_history
  const assetIdMap = new Map<string, string>();

  function track(collection: string, migrated: boolean) {
    if (!summary.byCollection[collection]) {
      summary.byCollection[collection] = { migrated: 0, skipped: 0 };
    }
    if (migrated) {
      summary.byCollection[collection].migrated++;
      summary.migrated++;
    } else {
      summary.byCollection[collection].skipped++;
      summary.skipped++;
    }
  }

  // --- savings_balances ---
  const savings = (raw.collections.savings_balances ?? []).map((doc) => {
    const compte = String(doc.compte ?? doc.id);
    const owner = String(doc.owner ?? resolveOwnerForSavings(compte, mapping));
    const newId = savingsAssetId(owner, compte);
    const changed = newId !== doc.id;
    if (changed) assetIdMap.set(doc.id, newId);
    track('savings_balances', changed);
    return { ...doc, id: newId };
  });

  // --- account_balances ---
  const accounts = (raw.collections.account_balances ?? []).map((doc) => {
    const compte = String(doc.compte ?? doc.id);
    const owner = String(doc.owner ?? resolveOwnerForAccount(compte, mapping));
    const newId = courantAssetId(owner, compte);
    const changed = newId !== doc.id;
    if (changed) assetIdMap.set(doc.id, newId);
    track('account_balances', changed);
    return { ...doc, id: newId };
  });

  // --- placements ---
  const placements = (raw.collections.placements ?? []).map((doc) => {
    const nom = String(doc.nom ?? '');
    const type = String(doc.type ?? 'placement');
    const owner = String(doc.owner ?? mapping.default_owner);
    // Garde l'auto-ID Firestore comme id du doc (CRUD stable),
    // mais calcule le assetId canonique pour l'historique
    const canonicalAssetId = placementAssetId(owner, nom, type);
    const oldId = doc.id;
    if (oldId !== canonicalAssetId) assetIdMap.set(oldId, canonicalAssetId);
    track('placements', oldId !== canonicalAssetId);
    // On ne change PAS doc.id ici (l'auto-ID reste la clé Firestore du placement)
    // mais on ajoute assetId pour que placement_history soit recalculé
    return { ...doc, _canonicalAssetId: canonicalAssetId };
  });

  // --- placement_history ---
  const history = (raw.collections.placement_history ?? []).map((doc) => {
    const oldAssetId = String(doc.assetId ?? '');

    // Portfolio : inchangé
    if (oldAssetId.startsWith('portfolio_')) {
      track('placement_history', false);
      return doc;
    }

    // Déjà canonique : skip
    if (isCanonicalAssetId(oldAssetId)) {
      track('placement_history', false);
      return doc;
    }

    // Cherche dans la table de correspondance (construite depuis savings/accounts/placements)
    let newAssetId = assetIdMap.get(oldAssetId);

    // Fallback : reconstruire depuis les champs de l'entrée
    if (!newAssetId) {
      const owner = String(doc.owner ?? mapping.default_owner);
      const nom = String(doc.nom ?? oldAssetId);
      const type = String(doc.type ?? 'placement');
      if (type === 'courants' || type === 'courant' || type === 'cash') {
        newAssetId = courantAssetId(owner, nom);
      } else if (type === 'epargne' || type === 'savings' || type === 'livret') {
        newAssetId = savingsAssetId(owner, nom);
      } else {
        newAssetId = placementAssetId(owner, nom, type);
      }
    }

    const date = String(doc.date ?? '');
    const newDocId = date ? `${newAssetId}_${date}` : doc.id;
    const changed = newAssetId !== oldAssetId;
    track('placement_history', changed);
    return { ...doc, id: newDocId, assetId: newAssetId };
  });

  // patrimoine_snapshots : pas d'assetId direct, inchangé
  const snapshots = (raw.collections.patrimoine_snapshots ?? []).map((doc) => {
    track('patrimoine_snapshots', false);
    return doc;
  });

  const migratedBackup: PatrimoineBackup = {
    exportedAt: raw.exportedAt,
    collections: {
      savings_balances: savings,
      account_balances: accounts,
      placements: placements,
      placement_history: history,
      patrimoine_snapshots: snapshots,
    },
  };

  return { backup: migratedBackup, summary };
}

/** Télécharge le backup migré sous forme de fichier JSON. */
export function downloadMigratedBackup(backup: PatrimoineBackup): void {
  const date = new Date().toISOString().split('T')[0];
  const json = JSON.stringify(backup, null, 2);
  const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = `patrimoine-migrated-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Réimporte les collections migrées dans Firestore (hors placements manuels — à re-créer via UI). */
export async function importMigratedBackup(
  backup: PatrimoineBackup,
  db: import('firebase/firestore').Firestore,
): Promise<Record<string, number>> {
  const { writeBatch, doc } = await import('firebase/firestore');

  const BATCH_SIZE = 450;
  const written: Record<string, number> = {};

  const collectionsToImport = [
    'savings_balances',
    'account_balances',
    'placement_history',
  ] as const;

  for (const name of collectionsToImport) {
    const docs = backup.collections[name] ?? [];
    written[name] = 0;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      docs.slice(i, i + BATCH_SIZE).forEach((d) => {
        const { id, _canonicalAssetId, ...data } = d as BackupDoc & { _canonicalAssetId?: string };
        batch.set(doc(db, name, id), data);
      });
      await withRetry(() => batch.commit());
      written[name] += Math.min(BATCH_SIZE, docs.length - i);
    }
  }

  return written;
}
