import { normalizeFlowCategory } from '../constants/transactionFlowCategories';
import type {
  GapSuspectReason,
  MonthlySavingsGapSuspect,
  Transaction,
} from '../types/banking.types';

const CURRENCY_TOLERANCE = 0.01;
const MAX_SUSPECTS = 20;

interface GapSuspectsInput {
  month: string;
  accountName: string;
  gap: number;
  transactions: Transaction[];
}

const nextMonthFirstDay = (month: string): string => {
  const [year, index] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year!, index!, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
};

/**
 * Opérations d'un compte courant susceptibles d'expliquer son écart de rapprochement :
 * mois d'affectation différent du mois de la date, en attente, datées sur une borne du mois,
 * ou de montant égal à l'écart. Les plus concordantes viennent en premier.
 */
export function findGapSuspects(input: GapSuspectsInput): MonthlySavingsGapSuspect[] {
  if (Math.abs(input.gap) <= CURRENCY_TOLERANCE) return [];
  const account = normalizeFlowCategory(input.accountName);
  const closingDate = nextMonthFirstDay(input.month);
  const suspects: MonthlySavingsGapSuspect[] = [];

  for (const transaction of input.transactions) {
    if (normalizeFlowCategory(transaction.compte) !== account) continue;
    const date = transaction.date.slice(0, 10);
    const inMonth = date.slice(0, 7) === input.month;
    const reasons: GapSuspectReason[] = [];

    if (inMonth && transaction.moisAffectation && transaction.moisAffectation !== input.month) {
      reasons.push('ASSIGNED_ELSEWHERE');
    }
    if (!inMonth && transaction.moisAffectation === input.month) reasons.push('ASSIGNED_HERE');
    if (inMonth && transaction.enAttente) reasons.push('PENDING');
    if (date === `${input.month}-01` || date === closingDate) reasons.push('BOUNDARY_DATE');
    if (
      (inMonth || reasons.length > 0) &&
      Math.abs(Math.abs(transaction.montant) - Math.abs(input.gap)) <= CURRENCY_TOLERANCE
    ) {
      reasons.push('MATCHES_GAP');
    }
    if (reasons.length === 0) continue;

    suspects.push({
      transactionId: transaction.id,
      date,
      libelle: transaction.libelle,
      montant: transaction.montant,
      ...(transaction.moisAffectation ? { moisAffectation: transaction.moisAffectation } : {}),
      reasons,
    });
  }

  const rank = (suspect: MonthlySavingsGapSuspect): number =>
    suspect.reasons.includes('MATCHES_GAP') ? 100 + suspect.reasons.length : suspect.reasons.length;
  return suspects
    .sort((a, b) => rank(b) - rank(a) || a.date.localeCompare(b.date))
    .slice(0, MAX_SUSPECTS);
}
