import type { Transaction } from '../types/banking.types';
import type { TransactionFilters } from '../context/TransactionContext';
import { normalizeSearchValue, buildAmountSearchValues } from './searchHelpers';

/**
 * Pure filter pipeline shared between TransactionContext and the test suite.
 *
 * Steps (in order):
 *   1. Drop incomplete entries (missing date/libelle).
 *   2. Apply equality filters: compte, type (dep/rec), pointe (oui/non),
 *      categorie.
 *   3. Apply date filters: year + month against `moisAffectation` (fallback
 *      `date.slice(0,7)`).
 *   4. Apply free-text search across libelle, commentaire, and every
 *      formatted-amount variant.
 *   5. Sort by date desc (most recent first); falsy dates fall back to
 *      empty string so they sort last.
 *
 * The search input is expected to be the **debounced** value, normalised
 * once at the call site (we re-normalise here defensively but it's cheap).
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  debouncedSearch: string,
): Transaction[] {
  const q = normalizeSearchValue(debouncedSearch);

  return transactions
    .filter((t) => {
      if (!t || !t.date || !t.libelle) return false;

      const montant = t.montant ?? 0;

      if (filters.compte && t.compte !== filters.compte) return false;
      if (filters.type === 'dep' && montant >= 0) return false;
      if (filters.type === 'rec' && montant <= 0) return false;

      const assignedMonth = t.moisAffectation || (t.date ? t.date.slice(0, 7) : '');
      const assignedYear = assignedMonth.slice(0, 4);

      if (filters.year && assignedYear !== filters.year) return false;
      if (filters.month && assignedMonth.slice(5, 7) !== filters.month) return false;

      if (filters.pointe === 'oui' && !t.pointe) return false;
      if (filters.pointe === 'non' && t.pointe) return false;

      if (filters.categorie && (t.categorie || '') !== filters.categorie) return false;

      if (q) {
        const libelleMatch = normalizeSearchValue(t.libelle || '').includes(q);
        const commentaireMatch = normalizeSearchValue(t.commentaire || '').includes(q);
        const amountMatch = buildAmountSearchValues(montant).some((v) => v.includes(q));
        if (!libelleMatch && !commentaireMatch && !amountMatch) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (da < db) return 1;
      if (da > db) return -1;
      return 0;
    });
}
