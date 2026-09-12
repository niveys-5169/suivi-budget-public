/**
 * Schéma d'assetId canonique : {owner}_{type}_{slug}
 * Ex: nicolas_courant_bforbank, romane_livret_livret-a, nicolas_placement_immobilier-paris
 *
 * Portefeuille boursier (portfolio_ISIN_Owner_Envelope) : géré séparément dans usePortfolio.
 */

/** Convertit un nom en slug URL-friendly sans accents. */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // tout non-alphanum → tiret
    .replace(/^-+|-+$/g, ''); // trim tirets
}

/** Générateur canonique d'assetId. */
export function makeAssetId(owner: string, type: string, nom: string): string {
  return `${owner.toLowerCase()}_${type}_${slugify(nom)}`;
}

/** assetId pour un compte courant. */
export function courantAssetId(owner: string, compte: string): string {
  return makeAssetId(owner, 'courant', compte);
}

/** assetId pour un livret d'épargne. */
export function savingsAssetId(owner: string, compte: string): string {
  return makeAssetId(owner, 'livret', compte);
}

/** assetId pour un placement manuel ou un PER. */
export function placementAssetId(owner: string, nom: string, type: string): string {
  const t = ['per', 'retirement', 'retraite'].includes(type.toLowerCase())
    ? 'retraite'
    : 'placement';
  return makeAssetId(owner, t, nom);
}

/**
 * Détecte si un assetId est déjà dans le bon format {owner}_{type}_{slug}.
 * Les IDs portefeuille (portfolio_*) sont considérés lisibles (format propre).
 */
export function isCanonicalAssetId(assetId: string): boolean {
  if (assetId.startsWith('portfolio_')) return true;
  return /^[a-z]+_(courant|livret|placement|retraite)_[a-z0-9-]+$/.test(assetId);
}
