import { CASH_ACCOUNT_NAME } from '../types/banking.types';
import {
  INTERNAL_TRANSFER_CATEGORY_ALIASES,
  normalizeFlowCategory,
  SAVINGS_DEPOSIT_CATEGORY_ALIASES,
  SAVINGS_WITHDRAWAL_CATEGORY_ALIASES,
} from '../constants/transactionFlowCategories';
import type {
  AccountEconomicRole,
  MonthlySavingsInput,
  MonthlySavingsPosition,
  MonthlySavingsStatus,
  Transaction,
  TransferKind,
} from '../types/banking.types';

const CURRENCY_TOLERANCE = 0.01;
const TRANSFER_DAY_WINDOW = 2;

const normalize = normalizeFlowCategory;
const SAVINGS_DEPOSIT_CATEGORIES = new Set(
  SAVINGS_DEPOSIT_CATEGORY_ALIASES.map(normalizeFlowCategory),
);
const SAVINGS_WITHDRAWAL_CATEGORIES = new Set(
  SAVINGS_WITHDRAWAL_CATEGORY_ALIASES.map(normalizeFlowCategory),
);
const INTERNAL_TRANSFER_CATEGORIES = new Set(
  INTERNAL_TRANSFER_CATEGORY_ALIASES.map(normalizeFlowCategory),
);

const isTransferLike = (transaction: Transaction): boolean => {
  if (explicitKind(transaction)) return true;
  return /\b(virement|transfert|livret|epargne|épargne)\b/i.test(transaction.libelle);
};

export const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const dayDistance = (a: string, b: string): number => {
  const aMs = Date.parse(`${a.slice(0, 10)}T12:00:00Z`);
  const bMs = Date.parse(`${b.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return Number.POSITIVE_INFINITY;
  return Math.abs(aMs - bMs) / 86_400_000;
};

const kindFromRoles = (
  left: Transaction,
  right: Transaction,
  leftRole: AccountEconomicRole,
  rightRole: AccountEconomicRole,
): TransferKind => {
  if (leftRole === 'OPERATING' && rightRole === 'OPERATING') return 'INTERNAL_OPERATING';
  if (leftRole === 'SAVINGS' && rightRole === 'SAVINGS') return 'INTERNAL_SAVINGS';

  if (
    (leftRole === 'OPERATING' && rightRole === 'SAVINGS') ||
    (leftRole === 'SAVINGS' && rightRole === 'OPERATING')
  ) {
    const operating = leftRole === 'OPERATING' ? left : right;
    return operating.montant < 0 ? 'SAVINGS_DEPOSIT' : 'SAVINGS_WITHDRAWAL';
  }

  if (leftRole !== 'EXCLUDED' && rightRole !== 'EXCLUDED') return 'OTHER_INTERNAL';
  return 'UNCERTAIN';
};

const explicitKind = (transaction: Transaction): TransferKind | null => {
  const category = normalize(transaction.categorie);
  if (SAVINGS_DEPOSIT_CATEGORIES.has(category)) return 'SAVINGS_DEPOSIT';
  if (SAVINGS_WITHDRAWAL_CATEGORIES.has(category)) return 'SAVINGS_WITHDRAWAL';
  if (INTERNAL_TRANSFER_CATEGORIES.has(category)) return 'OTHER_INTERNAL';
  return null;
};

const statusFor = (capacity: number, unallocated: number): MonthlySavingsStatus => {
  if (capacity < -CURRENCY_TOLERANCE) return 'DEFICIT';
  if (Math.abs(capacity) <= CURRENCY_TOLERANCE) return 'BALANCED';
  if (unallocated > CURRENCY_TOLERANCE) return 'AVAILABLE_TO_SAVE';
  if (unallocated < -CURRENCY_TOLERANCE) return 'OVER_ALLOCATED';
  return 'FULLY_ALLOCATED';
};

/**
 * Calcule la position d'épargne mensuelle à partir de données déjà chargées.
 * Cette interface pure est l'unique seam métier : aucune dépendance React ou Firestore.
 */
export function calculateMonthlySavingsPosition(
  input: MonthlySavingsInput,
): MonthlySavingsPosition {
  const operatingAccounts = input.accounts.filter((account) => account.role === 'OPERATING');
  const missingOpeningBalances = operatingAccounts
    .filter((account) => account.openingBalance === null)
    .map((account) => account.name);
  const missingClosingBalances = operatingAccounts
    .filter((account) => account.closingBalance === null)
    .map((account) => account.name);

  const accountRoles = new Map(
    input.accounts.map((account) => [normalize(account.name), account.role] as const),
  );
  const relevantTransactions = input.transactions.filter(
    (transaction) => transaction.date.slice(0, 7) === input.month,
  );
  const processed = new Set<string>();
  const uncertainIds = new Set<string>();
  const untrackedAccounts = new Set<string>();

  let savingsDeposits = 0;
  let savingsWithdrawals = 0;
  let capacityFromTransactions = 0;
  let unmatchedTransfers = 0;
  let uncertainTransfers = 0;

  for (const transaction of relevantTransactions) {
    if (!accountRoles.has(normalize(transaction.compte))) {
      untrackedAccounts.add(transaction.compte || CASH_ACCOUNT_NAME);
    }
  }

  for (const transaction of relevantTransactions) {
    if (processed.has(transaction.id)) continue;
    const role = accountRoles.get(normalize(transaction.compte));
    if (!role || role === 'EXCLUDED' || role === 'INVESTMENT') continue;

    if (uncertainIds.has(transaction.id)) {
      capacityFromTransactions += transaction.montant;
      processed.add(transaction.id);
      continue;
    }

    const candidates = relevantTransactions.filter((candidate) => {
      if (candidate.id === transaction.id || processed.has(candidate.id)) return false;
      const candidateRole = accountRoles.get(normalize(candidate.compte));
      if (!candidateRole || candidateRole === 'EXCLUDED') return false;
      return (
        normalize(candidate.compte) !== normalize(transaction.compte) &&
        roundCurrency(candidate.montant + transaction.montant) === 0 &&
        dayDistance(candidate.date, transaction.date) <= TRANSFER_DAY_WINDOW &&
        (isTransferLike(transaction) || isTransferLike(candidate))
      );
    });

    if (candidates.length === 1) {
      const candidate = candidates[0]!;
      const candidateRole = accountRoles.get(normalize(candidate.compte))!;
      const kind = kindFromRoles(transaction, candidate, role, candidateRole);
      processed.add(transaction.id);
      processed.add(candidate.id);
      if (kind === 'SAVINGS_DEPOSIT') savingsDeposits += Math.abs(transaction.montant);
      if (kind === 'SAVINGS_WITHDRAWAL') savingsWithdrawals += Math.abs(transaction.montant);
      continue;
    }

    if (candidates.length > 1) {
      uncertainTransfers += 1;
      uncertainIds.add(transaction.id);
      candidates.forEach((candidate) => uncertainIds.add(candidate.id));
      capacityFromTransactions += transaction.montant;
      processed.add(transaction.id);
      continue;
    }

    const kind = explicitKind(transaction);
    if (kind === 'SAVINGS_DEPOSIT') {
      savingsDeposits += Math.abs(transaction.montant);
      processed.add(transaction.id);
      continue;
    }
    if (kind === 'SAVINGS_WITHDRAWAL') {
      savingsWithdrawals += Math.abs(transaction.montant);
      processed.add(transaction.id);
      continue;
    }
    if (kind === 'OTHER_INTERNAL') {
      processed.add(transaction.id);
      continue;
    }

    if (!transaction.categorie && /\bvirement\b/i.test(transaction.libelle)) {
      uncertainIds.add(transaction.id);
      uncertainTransfers += 1;
      unmatchedTransfers += 1;
    }
    capacityFromTransactions += transaction.montant;
  }

  savingsDeposits = roundCurrency(savingsDeposits);
  savingsWithdrawals = roundCurrency(savingsWithdrawals);
  const netSavings = roundCurrency(savingsDeposits - savingsWithdrawals);
  capacityFromTransactions = roundCurrency(capacityFromTransactions);

  const boundariesAvailable =
    operatingAccounts.length > 0 &&
    missingOpeningBalances.length === 0 &&
    missingClosingBalances.length === 0;

  let openingOperatingBalance: number | null = null;
  let closingOperatingBalance: number | null = null;
  let operatingBalanceDelta: number | null = null;
  let savingsCapacity: number | null = null;
  let unallocatedSurplus: number | null = null;
  let status: MonthlySavingsStatus | null = null;
  let reconciliationDelta: number | null = null;

  if (boundariesAvailable) {
    openingOperatingBalance = roundCurrency(
      operatingAccounts.reduce((sum, account) => sum + account.openingBalance!, 0),
    );
    closingOperatingBalance = roundCurrency(
      operatingAccounts.reduce((sum, account) => sum + account.closingBalance!, 0),
    );
    operatingBalanceDelta = roundCurrency(closingOperatingBalance - openingOperatingBalance);
    savingsCapacity = roundCurrency(operatingBalanceDelta + netSavings);
    unallocatedSurplus = roundCurrency(savingsCapacity - netSavings);
    status = statusFor(savingsCapacity, unallocatedSurplus);
    reconciliationDelta = roundCurrency(savingsCapacity - capacityFromTransactions);
  }

  const hasPartialSignal =
    uncertainIds.size > 0 ||
    untrackedAccounts.size > 0 ||
    (reconciliationDelta !== null && Math.abs(reconciliationDelta) > CURRENCY_TOLERANCE);

  return {
    month: input.month,
    openingOperatingBalance,
    closingOperatingBalance,
    operatingBalanceDelta,
    savingsDeposits,
    savingsWithdrawals,
    netSavings,
    savingsCapacity,
    capacityFromTransactions,
    unallocatedSurplus,
    status,
    isCompleteMonth: input.isCompleteMonth,
    dataQuality: {
      calculationStatus: !boundariesAvailable
        ? 'UNAVAILABLE'
        : hasPartialSignal
          ? 'PARTIAL'
          : 'COMPLETE',
      missingOpeningBalances,
      missingClosingBalances,
      unmatchedTransfers,
      uncertainTransfers,
      untrackedTransactionAccounts: [...untrackedAccounts].sort(),
      reconciliationDelta,
    },
  };
}
