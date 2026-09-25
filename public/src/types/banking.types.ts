import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

/** Toute forme de date rencontrée selon la source (Firestore, JSON, legacy). */
export type FirestoreDateLike =
  | Timestamp
  | Date
  | { toMillis?: () => number; toDate?: () => Date; seconds?: number; nanoseconds?: number }
  | string
  | number
  | null
  | undefined;

export const CurrencyZ = z.enum(['EUR', 'USD', 'GBP', 'CHF', 'JPY']);
export type Currency = z.infer<typeof CurrencyZ>;

/**
 * Compte virtuel, non relié à un compte bancaire réel, proposé dans les
 * formulaires de transaction pour comptabiliser les dépenses/recettes en
 * espèces dans les bonnes catégories.
 */
export const CASH_ACCOUNT_NAME = 'Liquide';

export const AccountTypeZ = z.enum(['CHECKING', 'SAVINGS', 'INVESTMENT', 'CRYPTO']);
export type AccountType = z.infer<typeof AccountTypeZ>;

// Catégories OUVERTES — viennent de Firestore (FR libre)
export type TransactionCategory = string;

export interface OwnerMapping {
  owners: string[];
  accounts: Record<string, string>;
  savings_patterns: Record<string, string>;
  default_owner: string;
}

export interface RavConfig {
  revenu_mensuel_net: number | null;
  revenu_categories: string[] | null;
  depense_categories: string[] | null;
  provision_salaires?: Record<string, { categorie: string; montant: number }>;
  included_accounts?: string[];
}

export interface Discrepancy {
  id?: string;
  source_1: string;
  value_1: number;
  source_2: string;
  value_2: number;
  detected_on: Timestamp;
  description: string;
  suggested_action: string;
  threshold_used: number;
  status: 'unresolved' | 'acknowledged' | 'resolved';
  acknowledgements?: Array<{
    user_id: string;
    timestamp: Timestamp;
    reason?: string;
  }>;
}

export interface ProposedBalance {
  account_id: string;
  balance_value: number;
  balance_date: Timestamp;
  source: string;
  source_timestamp: Timestamp | null;
  raw_source_data: Record<string, unknown>;
  owner?: string;
  processed_status?: 'pending_validation' | 'validated';
}

export interface BaseBalance {
  id: string;
  compte: string;
  current_balance: number; // New field, replaces 'solde'
  solde?: number; // Keep for compatibility during migration
  source: string;
  source_timestamp: Timestamp | null;
  last_reconciled_date?: Timestamp;
  status: 'reconciled' | 'pending_review' | 'discrepancy_unresolved';
  /** Écart d'audit du contrôle de cohérence (solde Linxo − solde calculé). */
  ecart?: number;
  /** Date de réception du mail Linxo qui a fourni ce solde. */
  emailDate?: Timestamp | null;
  discrepancies?: Discrepancy[];
  owner?: string;
  date?: string;
  lastUpdated?: Timestamp | null;
  is_savings?: boolean;
}

export type AccountBalance = BaseBalance;

export type SavingsBalance = BaseBalance;

export interface BudgetBase {
  id: string;
  categorie: string;
  nom: string;
  montant: number;
  actif: boolean;
  type: 'mensuel' | 'annuel' | 'revenu' | 'ponctuel' | string;
  isIncome?: boolean;
  updatedAt?: Timestamp;
  moisAttendus?: number[];
  compte?: string | null;
  periode?: {
    debut: string;
    fin: string;
  };
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  iban: string;
  lastFourDigits: string;
  status: 'ACTIVE' | 'FROZEN' | 'PENDING';
  colorGradient: string[];
  lastTransactionDate: string | null;
  bankName?: string;
  owner?: string;
  isReconciled?: boolean;
}

/**
 * Modèle canonique d'une transaction bancaire — aligné sur le document Firestore.
 *
 * Tous les champs requis sont garantis par `normalizeTransaction()` : un doc qui
 * en manque un est rejeté à la frontière. Les anciens alias anglais (amount,
 * merchantName, category, accountId, sourceAccount, isReconciled, status,
 * currency, sourceDate) ont été supprimés — la source de vérité est en français.
 */
export interface Transaction {
  id: string;
  date: string;
  libelle: string;
  montant: number;
  compte: string;
  pointe: boolean;
  categorie?: string;
  /** Catégorie brute (avant normalisation) reçue de la source d'import. */
  rawCategorie?: string;
  commentaire?: string;
  moisAffectation?: string;
  source?: string;
  importedAt?: Timestamp | null;
  /** Date de réception du mail Linxo source (imports Gmail uniquement). */
  emailDate?: Date;
  /** Opération notifiée « en attente » par Linxo (pas encore comptabilisée). */
  enAttente?: boolean;
  /** Recharge Tronity : compte EDF cible du crédit créé au pointage. */
  edfCompte?: string;
  /** Crédit EDF : id de la recharge Tronity qui l'a généré (au pointage). */
  rechargeId?: string;
  /** Marqueur enrichi côté UI (récurrence détectée). Jamais persisté. */
  isSubscription?: boolean;
  /** URL de logo enrichie côté UI pour les vues "Private". Jamais persisté. */
  merchantLogoUrl?: string;
}

export type AccountEconomicRole = 'OPERATING' | 'SAVINGS' | 'INVESTMENT' | 'EXCLUDED';

export type TransferKind =
  | 'EXTERNAL'
  | 'INTERNAL_OPERATING'
  | 'SAVINGS_DEPOSIT'
  | 'SAVINGS_WITHDRAWAL'
  | 'INTERNAL_SAVINGS'
  | 'OTHER_INTERNAL'
  | 'UNCERTAIN';

export type TransferConfidence = 'EXACT' | 'HIGH' | 'UNCERTAIN';

export type MonthlySavingsStatus =
  'DEFICIT' | 'BALANCED' | 'AVAILABLE_TO_SAVE' | 'FULLY_ALLOCATED' | 'OVER_ALLOCATED';

export type MonthlySavingsCalculationStatus = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';

export interface MonthlySavingsAccount {
  id: string;
  name: string;
  role: AccountEconomicRole;
  owner?: string;
  openingBalance: number | null;
  closingBalance: number | null;
}

export interface MonthlySavingsInput {
  month: string;
  accounts: MonthlySavingsAccount[];
  transactions: Transaction[];
  isCompleteMonth: boolean;
}

export interface MonthlySavingsDataQuality {
  calculationStatus: MonthlySavingsCalculationStatus;
  missingOpeningBalances: string[];
  missingClosingBalances: string[];
  unmatchedTransfers: number;
  uncertainTransfers: number;
  untrackedTransactionAccounts: string[];
  reconciliationDelta: number | null;
}

/**
 * Classement d'une opération par le moteur d'épargne mensuelle.
 * COUNTED et UNCERTAIN composent `capacityFromTransactions`.
 */
export type MonthlySavingsEntryKind =
  | 'SAVINGS_DEPOSIT'
  | 'SAVINGS_WITHDRAWAL'
  | 'INTERNAL_TRANSFER'
  | 'UNCERTAIN'
  | 'COUNTED'
  | 'UNTRACKED'
  | 'IGNORED';

export interface MonthlySavingsEntry {
  transactionId: string;
  date: string;
  libelle: string;
  compte: string;
  montant: number;
  kind: MonthlySavingsEntryKind;
  /** Compte de la contrepartie appariée, pour un virement neutralisé. */
  counterpartAccount?: string;
}

/** Rapprochement d'un compte courant : solde attendu d'après les opérations vs solde réel. */
export interface MonthlySavingsAccountReconciliation {
  name: string;
  openingBalance: number;
  transactionsTotal: number;
  expectedClosingBalance: number;
  closingBalance: number;
  gap: number;
}

export interface MonthlySavingsBreakdown {
  entries: MonthlySavingsEntry[];
  accounts: MonthlySavingsAccountReconciliation[];
}

export interface MonthlySavingsPosition {
  month: string;
  openingOperatingBalance: number | null;
  closingOperatingBalance: number | null;
  operatingBalanceDelta: number | null;
  savingsDeposits: number;
  savingsWithdrawals: number;
  netSavings: number;
  savingsCapacity: number | null;
  capacityFromTransactions: number;
  unallocatedSurplus: number | null;
  status: MonthlySavingsStatus | null;
  isCompleteMonth: boolean;
  dataQuality: MonthlySavingsDataQuality;
  breakdown: MonthlySavingsBreakdown;
}

export type AccountStatus =
  | 'reconciled'
  | 'pending_review'
  | 'discrepancy_unresolved'
  | 'unresolved'
  | 'acknowledged'
  | string;

export interface BalancePoint {
  date: string;
  amount: number;
}

export interface Budget {
  category: TransactionCategory;
  label: string;
  spent: number;
  limit: number;
  currency: Currency;
}

export interface MonthOverride {
  skipped?: boolean;
  linkedTxId?: string;
  linkedAmount?: number;
  linkedDate?: string;
}

export interface RecurrenceApprovalEntry {
  txId: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD de la tx liée
}

export interface RecurrenceApproval {
  /** Miroir de entries[0] — conservé pour les documents/clients existants. */
  txId: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD de la tx matchée
  approvedAt: number; // Date.now()
  /** Toutes les tx liées au mois (ex. salaire versé en deux parties). Absent sur les anciens documents. */
  entries?: RecurrenceApprovalEntry[];
}

export interface Recurrence {
  id: string;
  label: string;
  category: string;
  expectedAmount: number; // stocké signé, comparé en abs()
  /** Legacy (documents créés avant anchorDate) — utiliser `getDayOfMonth()`. */
  dayOfMonth?: number;
  createdAt: Timestamp; // serverTimestamp() au niveau racine
  active: boolean;
  approvedMonths?: Record<string, RecurrenceApproval>; // clé "YYYY-MM"
  /** Date d'ancrage ISO YYYY-MM-DD : référence du jour de prélèvement mensuel. */
  anchorDate?: string;
  /** Libellés normalisés (normalizeLabel) reconnus pour l'auto-match fort. */
  aliases?: string[];
  source?: 'manual' | 'auto';
  /** Périodes explicitement ignorées ("pas ce mois-ci"), même format de clé que approvedMonths. */
  skippedPeriods?: string[];
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  desc: string;
  time: string;
  actionTab?: string;
}

export interface DashboardData {
  totalBalance: number;
  totalBalanceCurrency: Currency;
  variation30d: number;
  variationAmount30d: number;
  balanceHistory: BalancePoint[];
  accounts: Account[];
  recentTransactions: Transaction[];
  budgets: Budget[];
}

export interface BudgetConsumption {
  budgetId: string;
  nom: string;
  categorie: string;
  isIncome: boolean;
  montant: number;
  depense: number;
  reste: number;
  pourcentage: number;
  rythmeTheorique: number;
  ecartRythme: number;
  statut: string;
  periodeDebut: string;
  periodeFin: string;
  transactionIds: string[];
  sparklineData?: number[] | { day: number; amount: number }[];

  // English aliases for compatibility
  spent?: number;
  budget?: number;
  consumedPct?: number;
  remaining?: number;
  transactions?: Transaction[];
}

/** Props d'un tooltip Recharts custom. `T` = forme du datum sous-jacent. */
export interface ChartTooltipProps<T = Record<string, unknown>> {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string; dataKey?: string; payload: T }>;
  label?: string | number;
}
