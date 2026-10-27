import type { Transaction, VentilationPart } from '../types/banking.types';

/** Montant restant à la catégorie de la transaction une fois les parts retirées. */
export function ventilationRemainder(montant: number, parts: VentilationPart[]): number {
  const ventile = parts.reduce((sum, p) => sum + p.montant, 0);
  return Math.round((montant - ventile) * 100) / 100;
}

/**
 * Remplace chaque transaction ventilée par ses lignes d'analyse : le reste
 * (même id, catégorie de la transaction) puis une ligne par part (`<id>#vN`).
 * Le total par compte est inchangé ; chaque ligne garde la transaction
 * stockée dans `ventilationParent` pour que les écritures visent celle-ci.
 */
export function expandVentilations(transactions: Transaction[]): Transaction[] {
  return transactions.flatMap((tx) => {
    if (!tx.ventilation?.length) return [tx];
    const remainder = ventilationRemainder(tx.montant, tx.ventilation);
    const parts = tx.ventilation.map((part, i): Transaction => ({
      ...tx,
      id: `${tx.id}#v${i + 1}`,
      montant: part.montant,
      categorie: part.categorie,
      moisAffectation: part.moisAffectation || tx.moisAffectation,
      ventilationParent: tx,
    }));
    if (remainder === 0) return parts;
    return [{ ...tx, montant: remainder, ventilationParent: tx }, ...parts];
  });
}

/** Parts saisies en valeur absolue → parts stockées, signées comme la transaction. */
export function toVentilationParts(
  montant: number,
  parts: { montant: number | null; categorie: string; moisAffectation: string }[],
): VentilationPart[] {
  const sign = montant < 0 ? -1 : 1;
  return parts.map((p) => ({
    montant: sign * Math.abs(p.montant ?? 0),
    categorie: p.categorie,
    ...(p.moisAffectation ? { moisAffectation: p.moisAffectation } : {}),
  }));
}
