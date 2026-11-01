import type { Transaction } from '../../types/banking.types';

/**
 * Remonte aux transactions stockées : `TransactionContext` expose des lignes déjà ventilées
 * (`expandVentilations`), or `computeObservedValues` ventile lui-même. Sans ce retour en arrière,
 * les parts seraient ventilées deux fois.
 */
export function toStoredTransactions(rows: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  const stored: Transaction[] = [];
  for (const row of rows) {
    const source = row.ventilationParent ?? row;
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    stored.push(source);
  }
  return stored;
}
