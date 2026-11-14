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
  balanceType?: string;
  bankDate?: string | null;
  crossControl?: BankBalanceControl;
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
/** Part d'une transaction ventilée : montant signé comme la transaction. */
export interface VentilationPart {
  montant: number;
  categorie: string;
  moisAffectation?: string;
}

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
  bankStatus?: 'pending' | 'booked' | 'cancelled';
  linxoStatus?: 'waiting' | 'matched' | 'overdue' | 'not_applicable';
  bankObservationIds?: string[];
  firstBookedAt?: FirestoreDateLike;
  /** Recharge Tronity : compte EDF cible du crédit créé au pointage. */
  edfCompte?: string;
  /** Crédit EDF : id de la recharge Tronity qui l'a généré (au pointage). */
  rechargeId?: string;
  /**
   * Parts ventilées vers d'autres catégories. Le reste du montant garde la
   * catégorie et le mois d'affectation de la transaction elle-même.
   */
  ventilation?: VentilationPart[];
  /** Transaction stockée dont cette ligne est une part ventilée. Jamais persisté. */
  ventilationParent?: Transaction;
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
  /** Mois d'affectation saisi sur l'opération, s'il existe. */
  moisAffectation?: string;
}

export type GapSuspectReason =
  'ASSIGNED_ELSEWHERE' | 'ASSIGNED_HERE' | 'PENDING' | 'BOUNDARY_DATE' | 'MATCHES_GAP';

/** Opération susceptible d'expliquer l'écart de rapprochement d'un compte courant. */
export interface MonthlySavingsGapSuspect {
  transactionId: string;
  date: string;
  libelle: string;
  montant: number;
  moisAffectation?: string;
  reasons: GapSuspectReason[];
}

/** Rapprochement d'un compte courant : solde attendu d'après les opérations vs solde réel. */
export interface MonthlySavingsAccountReconciliation {
  name: string;
  openingBalance: number;
  transactionsTotal: number;
  expectedClosingBalance: number;
  closingBalance: number;
  gap: number;
  suspects: MonthlySavingsGapSuspect[];
}

export interface MonthlySavingsBreakdown {
  entries: MonthlySavingsEntry[];
  accounts: MonthlySavingsAccountReconciliation[];
  /**
   * Flux comptés et mouvements d'épargne dont le mois d'affectation diffère du mois de la
   * date. Montant : correction de la variation des comptes courants du mois (opposé de leur
   * effet s'ils en sortent, leur effet s'ils y entrent).
   */
  reassigned: MonthlySavingsEntry[];
}

export interface MonthlySavingsPosition {
  month: string;
  openingOperatingBalance: number | null;
  closingOperatingBalance: number | null;
  operatingBalanceDelta: number | null;
  savingsDeposits: number;
  savingsWithdrawals: number;
  netSavings: number;
  /** Somme des flux réaffectés (`breakdown.reassigned`), incluse dans la capacité. */
  affectationAdjustment: number;
  savingsCapacity: number | null;
  capacityFromTransactions: number;
  unallocatedSurplus: number | null;
  status: MonthlySavingsStatus | null;
  isCompleteMonth: boolean;
  dataQuality: MonthlySavingsDataQuality;
  breakdown: MonthlySavingsBreakdown;
}

/** Cumul de la capacité d'épargne de janvier jusqu'au mois affiché (inclus). */
export interface YearToDateSavings {
  /** Premier mois cumulé (`YYYY-01`). */
  fromMonth: string;
  /** Mois affiché (`YYYY-MM`). */
  toMonth: string;
  /** `null` si au moins un mois de la période est indisponible. */
  savingsCapacity: number | null;
  netSavings: number;
  unavailableMonths: string[];
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

/**
 * Crédit à taux fixe (immobilier, auto…). La mensualité n'est pas stockée :
 * elle est dérivée de `capitalInitial`, `tauxAnnuel` et `dureeMois` par
 * `utils/creditSchedule.ts` (amortissement à mensualité constante).
 */
export interface Credit {
  id: string;
  nom: string;
  owner?: string;
  capitalInitial: number;
  tauxAnnuel: number; // taux nominal annuel, en % (ex. 1.35)
  dureeMois: number;
  dateDebut: string; // ISO yyyy-mm-dd, date de la 1ère échéance
  assuranceMensuelle?: number;
  commentaire?: string;
}

export type NatureBien = 'appartement' | 'maison';
export type ClasseDpe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
/** `estime` : `montant` est réécrit chaque mois par le job d'estimation ; `manuel` : saisi par l'utilisateur. */
export type ModeValorisation = 'estime' | 'manuel';

/** Descriptif d'un bien immobilier (doc `placements`, champ `bien`). */
export interface BienImmobilier {
  adresse: string;
  codePostal: string;
  ville: string;
  nature: NatureBien;
  surface: number; // m²
  pieces: number;
  sallesDeBain?: number;
  terrain?: number; // m², maison seulement
  etage?: number; // appartement seulement
  nbEtages?: number;
  ascenseur?: boolean;
  garages: number;
  parkings: number;
  jardin: boolean;
  terrasse: boolean;
  balcon: boolean;
  dpe?: ClasseDpe;
  anneeConstruction?: number;
  prixAchat?: number;
  fraisNotaire?: number;
  fraisAgence?: number;
  travaux?: number;
  /** Cache du géocodage IGN, écrit par le job (vidé quand l'adresse change). */
  codeInsee?: string;
  lat?: number;
  lon?: number;
  scoreGeocodage?: number;
}

export type StatutEstimation =
  | 'OK'
  | 'INCOMPLETE_DATA'
  | 'GEOCODING_FAILED'
  | 'UNSUPPORTED_AREA'
  | 'NO_COMPARABLE_DATA'
  | 'PROVIDER_UNAVAILABLE';

/** Codes d'ajustement heuristiques (voir `src/property_estimator.py`). */
export type CodeAjustement =
  | 'GROUND_FLOOR'
  | 'NO_ELEVATOR'
  | 'TOP_FLOOR_ELEVATOR'
  | 'EXTRA_BATHROOM'
  | 'GARDEN'
  | 'TERRACE'
  | 'BALCONY'
  | `ENERGY_${ClasseDpe}`
  | 'ERA_PRE_1949'
  | 'ERA_1949_1974'
  | 'ERA_2001_2012'
  | 'ERA_POST_2012'
  | 'GARAGE'
  | 'PARKING'
  | 'LAND';

/** Un ajustement appliqué : facteur multiplicatif ou ajout en m² équivalents, avec son impact en €. */
export interface AjustementEstimation {
  code: CodeAjustement;
  facteur?: number;
  /** Facteur réellement appliqué (après plafonnement du multiplicateur). */
  facteurApplique?: number;
  m2?: number;
  montant: number;
  /** Valeur du bien qui motive l'ajustement (étiquette, étage, année, nombre…). */
  valeurBien?: string | number | boolean | null;
  /** `ademe` : valeur trouvée dans l'open data faute de saisie. */
  origine?: 'saisi' | 'ademe';
}

/** Vente comparable affichée pour justifier le prix au m² (données DVF publiques). */
export interface ComparableEstimation {
  date: string;
  distanceM: number;
  surface: number;
  pieces: number;
  prixM2: number;
}

/** Réindexation INSEE : indices de départ/actuel, ou ratios par millésime pour les comparables. */
export type ReindexationEstimation =
  | {
      trimestreDepart: string;
      indiceDepart: number;
      trimestreActuel: string;
      indiceActuel: number;
      ratio: number;
    }
  | { integree: true; ratios: Record<string, number> };

/** Traçabilité du calcul : pourquoi ce prix au m², ces comparables, ce multiplicateur. */
export interface JustificationEstimation {
  reference: {
    serie: string;
    prixM2: number;
    q25M2: number;
    q75M2: number;
    millesime: string;
    echantillon: number;
    echelle: 'communes' | 'departements' | 'voisinage';
    rayon?: number;
    source: 'cerema' | 'dvf' | 'dvf-voisinage';
  };
  comparables?: ComparableEstimation[];
  reindexation?: ReindexationEstimation;
  multiplicateur: { somme: number; applique: number; borne: 'min' | 'max' | null };
}

/** Résultat du dernier calcul d'estimation (doc `placements`, champ `estimation`). */
export interface EstimationImmobiliere {
  statut: StatutEstimation;
  date: string; // ISO yyyy-mm-dd
  valeur?: number;
  basse?: number;
  haute?: number;
  prixM2?: number;
  echantillon?: number;
  confiance?: 'faible' | 'moyenne' | 'haute';
  millesime?: string;
  echelle?: 'communes' | 'departements' | 'voisinage';
  source?: 'cerema' | 'dvf' | 'dvf-voisinage';
  /** Rayon (m) des ventes comparables, pour l'échelle `voisinage`. */
  rayon?: number;
  /** Caractéristiques trouvées dans le DPE ADEME faute de saisie. */
  dpeDetecte?: { dpe?: ClasseDpe; anneeConstruction?: number; etage?: number; source: 'ademe' };
  justification?: JustificationEstimation;
  multiplicateur?: number;
  ratioReindexation?: number;
  ajustements?: AjustementEstimation[];
}

/** Placement de type `immobilier` : un bien estimé automatiquement ou valorisé à la main. */
export interface PlacementImmobilier {
  id: string;
  nom: string;
  owner: string;
  type: 'immobilier';
  montant: number;
  modeValorisation: ModeValorisation;
  creditId?: string;
  bien: BienImmobilier;
  estimation?: EstimationImmobiliere;
}

export interface MonthOverride {
  skipped?: boolean;
  linkedTxId?: string;
  linkedAmount?: number;
  linkedDate?: string;
}

export interface RecurrenceApprovalEntry {
  bankCancelled?: boolean;
  txId: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD de la tx liée
}

export interface RecurrenceApproval {
  bankCancelled?: boolean;
  /** Miroir de entries[0] — conservé pour les documents/clients existants. */
  txId: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD de la tx matchée
  approvedAt: number; // Date.now()
  /** Toutes les tx liées au mois (ex. salaire versé en deux parties). Absent sur les anciens documents. */
  entries?: RecurrenceApprovalEntry[];
}

/** Montant antérieur d'une récurrence : s'applique aux périodes strictement avant `until`. */
export interface RecurrenceAmountSegment {
  until: string; // "YYYY-MM", exclu
  amount: number; // signé
}

export interface Recurrence {
  id: string;
  label: string;
  category: string;
  /** Montant courant (périodes ≥ dernier `until`). Pour une période donnée, utiliser `getAmountForPeriod()`. */
  expectedAmount: number; // stocké signé, comparé en abs()
  /** Paliers antérieurs triés par `until` croissant, créés par un réajustement. */
  amountHistory?: RecurrenceAmountSegment[];
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
  /** Transactions dont le rattachement suggéré a été refusé (« Ignorer ») : le matcher ne les reproposera plus. */
  rejectedTxIds?: string[];
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  desc: string;
  time: string;
  actionTab?: string;
  episodeKey?: string;
}

export interface BankAccountConnection {
  stableId: string;
  name: string;
  currency: string;
  compte: string;
  enabled: boolean;
}
export interface BankConnection {
  mode?: 'observation' | 'active' | 'disabled';
  id: string;
  bank: string;
  ownerUid: string;
  accounts: BankAccountConnection[];
  status: 'active' | 'reconnect' | 'temporary_error' | 'technical_error';
  validUntil?: FirestoreDateLike;
  lastAttemptAt?: FirestoreDateLike;
  lastSuccessAt?: FirestoreDateLike;
  createdAt?: FirestoreDateLike;
  errorSince?: FirestoreDateLike;
  errorCode?: string | null;
}
export interface BankObservationDetails {
  enableDate?: string;
  enableReceivedAt?: FirestoreDateLike;
  linxoDate?: string | null;
  linxoReceivedAt?: FirestoreDateLike;
}
export interface BankSuggestion extends BankObservationDetails {
  canonicalRows?: Pick<
    Transaction,
    | 'id'
    | 'date'
    | 'compte'
    | 'montant'
    | 'libelle'
    | 'categorie'
    | 'commentaire'
    | 'pointe'
    | 'moisAffectation'
  >[];
  kind?: 'transition';
  enableObservationId: string;
  linxoObservationId: string;
  compte?: string;
  enableLabel?: string;
  linxoLabel?: string;
  montant?: number;
}
export interface BankBalanceControl {
  status: 'concordant' | 'explained' | 'waiting' | 'discrepancy';
  compte: string;
  difference?: number | null;
  reason?: string;
  provisional?: boolean;
  firstUnresolvedAt?: FirestoreDateLike;
  enableBalance?: number | null;
  linxoBalance?: number | null;
  linxoReceivedAt?: FirestoreDateLike;
  movements?: { id: string; libelle: string; montant: number; date: string }[];
}
export interface BankReconciliationReport {
  monitoringEnabled?: boolean;
  id: string;
  suggestions?: BankSuggestion[];
  matches?: BankSuggestion[];
  waiting?: (BankObservationDetails & {
    id: string;
    compte: string;
    libelle: string;
    montant: number;
    bankStatus: Transaction['bankStatus'];
  })[];
  missing?: { id: string; compte: string; libelle: string; firstBookedAt?: FirestoreDateLike }[];
  status?: BankBalanceControl['status'];
  compte?: string;
  firstUnresolvedAt?: FirestoreDateLike;
}
export interface BankSyncResult {
  id: string;
  status: 'running' | 'success' | 'partial' | 'error';
  imported?: number;
  sources?: Record<string, string>;
  errorCode?: string;
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

export interface PortfolioTx {
  type: string;
  date: string;
  quantity: number | string;
  amount: number | string;
  fees?: number | string;
  isin?: string;
  ownerKey?: string;
  owner?: string;
  envelope?: string;
  account?: string;
  accountId?: string;
}

export interface PortfolioContractAccount {
  id: string;
  label: string;
  owner: string;
  ownerKey?: string;
  envelope: string;
  broker?: string;
  productId?: string | null;
  openedAt?: string | null;
  status?: 'open' | 'closed';
}

export interface Holding {
  docId: string;
  isin: string;
  name: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  totalCost: number;
  currentValue: number;
  lastPrice: number;
  account: string;
  accountId?: string;
  accountLabel?: string;
  broker?: string;
  owner: string;
  currency: string;
  unrealizedGain: number;
  unrealizedGainPct: number;
  updatedAt: Timestamp | null;
}

export interface PortfolioMirrorData {
  holdings: Holding[];
  accounts?: PortfolioContractAccount[];
  transactions?: PortfolioTx[];
  totalValue: number;
  syncedAt: FirestoreDateLike | null;
  uid?: string;
}

export interface WeeklyReportConfig {
  enabled: boolean;
  recipients: string[];
  dayOfWeek?: number; // 1 = Lundi, 2 = Mardi, ..., 5 = Vendredi, 7 = Dimanche (défaut: 5)
  sendHour?: number; // Heure 7..22 Europe/Paris (défaut: 18)
  includeCheckingBalances?: boolean; // défaut true
  includeSavingsBalances?: boolean; // défaut false
  includeWeeklyExpenses?: boolean; // défaut true
  includeBudgetAlerts?: boolean; // défaut true
  budgetWarningThreshold?: number; // défaut 80 (ex: 75, 80, 85, 90)
  lastSentAt?: FirestoreDateLike;
  lastStatus?: 'success' | 'error';
  lastError?: string | null;
  lastRecipients?: string[];
  updatedAt?: FirestoreDateLike;
}

/** Fiche « Ma semaine » (collection `weekly_recaps`, ID = date de fin AAAA-MM-JJ). */
export interface WeeklyRecapTransaction {
  date: string;
  libelle: string;
  montant: number; // positif (dépense)
  categorie: string;
  compte: string;
}

export interface WeeklyRecapBudget {
  categorie: string;
  budget: number;
  depense: number;
  pourcentage: number;
  reste: number;
  depassement: number;
  depense_mois_precedent?: number;
  ecart_mois_precedent?: number;
}

export interface WeeklyRecapEnvelope {
  categorie: string;
  budget: number;
  depense: number;
  reste: number;
  pourcentage: number;
  echeance: string; // YYYY-MM
}

export interface WeeklyRecap {
  id: string;
  period: { start: string; end: string; month: string };
  options: { warning_threshold: number };
  balances: {
    accounts: { compte: string; solde: number; status_label: string; status_tone: string }[];
    total: number;
    savings_accounts: { compte: string; solde: number }[];
    total_savings: number;
  };
  expenses: {
    total_expenses: number;
    categories: { categorie: string; montant: number; pourcentage: number }[];
    transactions?: WeeklyRecapTransaction[];
    top_transactions: WeeklyRecapTransaction[];
  };
  budgets: {
    variables: WeeklyRecapBudget[];
    exceeded: WeeklyRecapBudget[];
    warning: WeeklyRecapBudget[];
    envelopes: WeeklyRecapEnvelope[];
  };
  source?: 'email' | 'backfill';
}

// ─── Projections long terme (route /projections, desktop) ───
/** Mois au format 'YYYY-MM'. */
export type ProjectionMonth = string;

/** Valeur qui peut être calculée depuis les données de l'app (auto) ou forcée (manuel). */
export interface ProjectionAutoValue {
  mode: 'auto' | 'manuel';
  manuel?: number;
}

export interface ProjectionPersonne {
  id: string;
  prenom: string;
  dateNaissance?: string; // YYYY-MM-DD
  ageFinActivite?: number;
}

export interface ProjectionEnfant {
  id: string;
  prenom?: string;
  dateNaissance: string; // YYYY-MM-DD
}

/** Phase de revenu d'une personne : cash après PAS, lissé sur 12 mois. */
export interface ProjectionPhaseRevenu {
  id: string;
  personneId: string;
  libelle: string;
  debut: ProjectionMonth;
  fin?: ProjectionMonth; // inclus ; absent = jusqu'à la fin de l'horizon
  netMensuel: ProjectionAutoValue; // auto = moyenne 12 mois des categoriesSource
  categoriesSource?: string[];
  revalorisationAnnuelle: number; // 0.015 = +1,5 %/an, appliquée chaque 1er janvier depuis l'année de `debut`
  montantsAnnuels?: Record<string, number>; // clé = année 'YYYY' ; montant mensuel retenu cette année-là (prime sur netMensuel × revalorisation)
}

/** Pension de retraite, en € de l'année de référence des prix, indexée sur l'inflation. */
export interface ProjectionPension {
  id: string;
  personneId: string;
  debut: ProjectionMonth;
  netAvantImpot: number;
  netApresImpot: number; // c'est ce montant qui entre dans les revenus
  montantsAnnuels?: Record<string, number>; // clé = année 'YYYY' ; montant mensuel courant retenu cette année-là (prime sur netApresImpot × inflation)
}

export interface ProjectionScenario {
  id: string;
  nom: string;
  phases: ProjectionPhaseRevenu[]; // phases propres au scénario (carrière qui varie)
  pensions: ProjectionPension[];
}

export interface ProjectionMontantDate {
  id: string;
  libelle: string;
  montant: number; // positif
  mois: ProjectionMonth;
}

export interface ProjectionCreditParam {
  id: string;
  libelle: string;
  creditId?: string; // lien vers la collection `credits`
  mode: 'auto' | 'manuel';
  mensualiteManuelle?: number;
  finManuelle?: ProjectionMonth; // dernier mois payé
  tauxAnnuelManuel?: number; // en %, ex. 4.17
  remboursementAnticipe?: { mois: ProjectionMonth; frais?: number };
}

/**
 * Montants réalisés d'un mois, en € courants : relevés dans les transactions ou saisis à la main.
 * Un champ absent garde la valeur théorique (ou relevée, pour une saisie partielle).
 */
export interface ProjectionMoisReel {
  revenusParPersonne?: Record<string, number>;
  caf?: number;
  /** Revenus non attribués à une personne ni à la CAF. */
  autresRevenus?: number;
  depenses?: number;
  /** Net signé : encaissements − dépenses exceptionnelles. */
  fluxExceptionnels?: number;
  /**
   * Épargne nette (versements − retraits sur les comptes d'épargne) : information sur
   * l'emploi de la capacité ; ni une dépense ni un revenu, l'argent reste dans le patrimoine.
   */
  epargneNette?: number;
  /**
   * Patrimoine réel hors PER et hors immobilier en fin de mois (historique des comptes) : la
   * projection se recale dessus et le capital initial, déjà présent sur les comptes, est soldé.
   */
  patrimoineFin?: number;
}

/** Origine des montants d'un mois de projection. */
export type ProjectionSourceMois = 'theorique' | 'releve' | 'manuel';

export type ProjectionClasseCategorie =
  'depense' | 'fixe' | 'exclu' | 'tresorerie' | 'interne' | 'revenu' | 'ponctuel';

export interface ProjectionPointAConfirmer {
  id: string;
  libelle: string;
  commentaire?: string;
}

export interface ProjectionParams {
  version: 1;
  horizon: { debut: ProjectionMonth; fin: ProjectionMonth; anneeReferencePrix: number };
  personnes: ProjectionPersonne[];
  enfants: ProjectionEnfant[];
  macro: { inflation: number; rendementCapital: number; rendementPatrimoine: number }; // taux annuels décimaux
  revenusCommuns: {
    phases: ProjectionPhaseRevenu[];
    pensions: ProjectionPension[];
    caf: {
      montant: ProjectionAutoValue;
      categoriesSource?: string[];
      evolutionAnnuelle: number;
      arretAuxAnsAine?: number; // ex. 20 : plus de CAF à partir du mois où l'aîné atteint cet âge
    };
  };
  scenarios: ProjectionScenario[]; // 1 à 5
  scenarioAfficheId: string;
  depenses: {
    budgetReference: ProjectionAutoValue; // €/mois, prix de l'année de référence, crédits inclus
    credits: ProjectionCreditParam[];
    exceptionnelles: ProjectionMontantDate[];
  };
  capital: {
    capitalInitial: number;
    encaissements: ProjectionMontantDate[];
    patrimoineDepart: ProjectionAutoValue; // patrimoine hors PER
    abondement?: { montantAnnuel: number; mois: number; finMois?: ProjectionMonth };
  };
  classesCategories: Record<string, ProjectionClasseCategorie>;
  aConfirmer: ProjectionPointAConfirmer[];
  /** Saisies manuelles par mois : priment sur les montants relevés et théoriques. */
  moisReels?: Record<ProjectionMonth, ProjectionMoisReel>;
  /** Paramètres des calculateurs détaillés (lot 2). Absent = comportement du lot 1. */
  calculateurs?: {
    /** true = les revenus des personnes viennent des calculateurs (« Auto (calculé) »). */
    actif?: boolean;
    fiscal?: ProjectionFiscalParams;
    retraite?: ProjectionRetraiteParams;
    activite?: ProjectionActiviteParams;
  };
}

/** Valeurs observées dans les données de l'app (sortie de utils/projection/autoValues.ts). */
export interface ProjectionValeursObservees {
  periode: { debut: string; fin: string } | null; // YYYY-MM-DD, 12 mois glissants
  budgetReference: number | null;
  detailCategories: {
    categorie: string;
    classe: ProjectionClasseCategorie;
    soldeNet: number;
    retenuAnnuel: number;
  }[];
  moyenneMensuelleParCategorie: Record<string, number>; // solde net / 12, signé
  credits: Record<
    string,
    { mensualite: number; fin: ProjectionMonth; tauxAnnuel: number; libelle: string }
  >; // clé = creditId
  patrimoineHorsPer: number | null;
  epargneNetteMensuelle: number | null;
}

export interface ProjectionCreditResolu {
  id: string;
  libelle: string;
  mensualite: number;
  fin?: ProjectionMonth;
  tauxAnnuel: number; // %
  remboursementAnticipe?: { mois: ProjectionMonth; frais?: number };
}

export interface ProjectionPhaseResolue extends Omit<ProjectionPhaseRevenu, 'netMensuel'> {
  netMensuel: number;
}

export interface ProjectionScenarioResolu extends Omit<ProjectionScenario, 'phases'> {
  phases: ProjectionPhaseResolue[];
  /** Calculateurs : cash mensuel après PAS (€ courants) par personne ; remplace phases et pensions. */
  revenusMensuels?: Record<string, Record<ProjectionMonth, number>>;
  /** Calculateurs : détail de la retraite par personne (valeurs de l'année de référence des prix). */
  retraiteDetail?: Record<string, ProjectionRetraiteResultat>;
  /** Calculateurs : libellé de phase de chaque mois pour la personne de référence (colonne B de Calc). */
  phasesMensuelles?: Record<ProjectionMonth, string>;
  /** Calculateurs : 1er mois de pension de chaque personne partie à la retraite dans l'horizon. */
  debutsRetraite?: Record<string, ProjectionMonth>;
}

/** Entrées numériques du moteur (sortie de resolveParams). */
export interface ProjectionInputs {
  horizon: ProjectionParams['horizon'];
  macro: ProjectionParams['macro'];
  personnes: ProjectionPersonne[];
  phasesCommunes: ProjectionPhaseResolue[];
  pensionsCommunes: ProjectionPension[];
  caf: { montant: number; evolutionAnnuelle: number; dernierMois?: ProjectionMonth };
  budgetReference: number;
  credits: ProjectionCreditResolu[];
  exceptionnelles: ProjectionMontantDate[];
  capitalInitial: number;
  encaissements: ProjectionMontantDate[];
  patrimoineDepart: number;
  abondement?: ProjectionParams['capital']['abondement'];
  scenarios: ProjectionScenarioResolu[];
  /** Montants réalisés par mois (relevés, complétés des saisies) : remplacent les théoriques. */
  moisReels?: Record<ProjectionMonth, { valeurs: ProjectionMoisReel; source: 'releve' | 'manuel' }>;
  /** Messages non bloquants de la résolution des calculateurs (bloc manquant, scénario non calculable). */
  messagesCalculateurs?: string[];
}

export interface ProjectionMoisResultat {
  mois: ProjectionMonth;
  phase: string; // phase de la personne de référence (1re personne) : 'Retraite' si pension, '—' sinon
  revenusParPersonne: Record<string, number>; // activité + pension
  caf: number;
  autresRevenus: number; // revenus réalisés non attribués (0 pour un mois théorique)
  epargneNette: number; // versements nets vers l'épargne relevés (0 pour un mois théorique)
  revenus: number; // Σ personnes + CAF + autres revenus
  creditsFixes: number;
  depensesCourantes: number;
  depenses: number; // fixes + courantes (hors exceptionnelles)
  capacite: number; // revenus − depenses
  depensesExceptionnelles: number;
  encaissements: number;
  remboursementsAnticipes: number; // positif = sortie de capital (CRD + frais)
  rendementCapital: number;
  capital: number; // jamais < 0
  prelevementPatrimoine: number; // déficit non couvert par le capital
  rendementPatrimoine: number;
  abondement: number;
  patrimoineHorsPer: number;
  patrimoineTotal: number;
  /** Patrimoine réel − patrimoine calculé avant recalage (0 si le mois n'est pas recalé). */
  ecartReel: number;
  /** true : patrimoine recalé sur le patrimoine réel du mois. */
  patrimoineReel: boolean;
  source: ProjectionSourceMois;
}

export interface ProjectionScenarioResultat {
  scenarioId: string;
  nom: string;
  mois: ProjectionMoisResultat[];
}

/** Résultat de l'import du classeur de simulation (utils/projection/importSimulationXlsx.ts). */
export interface ProjectionImportResult {
  params: ProjectionParams;
  /** Libellés des paramètres reconnus et repris. */
  reconnus: string[];
  /** Messages non bloquants (onglet ou libellé introuvable, valeur illisible…). */
  avertissements: string[];
}

// ─── Projections : rapport (utils/projection/projectionReport.ts) ───
/** Pension de retraite d'une personne, en € de l'année de référence des prix (communes + scénario). */
export interface ProjectionRetraitePersonne {
  personneId: string;
  prenom: string;
  netAvantImpot: number;
  netApresImpot: number;
  /** Détail par régime (calculateur de retraite) ; absent pour une pension saisie. */
  detail?: ProjectionRetraiteResultat;
}

export interface ProjectionRetraiteScenario {
  scenarioId: string;
  nom: string;
  parPersonne: ProjectionRetraitePersonne[];
  totalAvantImpot: number;
  totalApresImpot: number;
  /** Pensions après impôt du foyer / revenus d'activité du foyer au 1er mois (hors CAF) ; null si 0. */
  tauxRemplacement: number | null;
}

export interface ProjectionSyntheseScenario {
  scenarioId: string;
  nom: string;
  patrimoineFinal: number;
  /** En € de l'année de référence des prix. */
  patrimoineFinalReel: number;
  capitalFinal: number;
  horsPerFinal: number;
  /** Premier mois où le capital tombe à 0 après avoir été > 0 ; null sinon. */
  moisEpuisementCapital: ProjectionMonth | null;
  prelevementCumule: number;
  moisDeficit: number;
  /** Moyennes mensuelles sur l'horizon. */
  revenus: number;
  revenusParPersonne: Record<string, number>;
  depenses: number;
  capacite: number;
  /** Σ capacité − Σ dépenses exceptionnelles. */
  epargneCumulee: number;
}

/** Patrimoine total au 31/12 (ou au dernier mois de l'horizon) de chaque scénario. */
export interface ProjectionEvolutionAnnee {
  annee: number;
  parScenario: Record<string, number>;
}

/** Moyennes mensuelles d'une phase du scénario affiché. */
export interface ProjectionPhaseMoyenne {
  phase: string;
  nbMois: number;
  revenusParPersonne: Record<string, number>;
  caf: number;
  revenus: number;
  depenses: number;
  capacite: number;
}

/** Flux d'une année civile du scénario affiché (sommes). */
export interface ProjectionAnneeDetail {
  annee: number;
  phaseDecembre: string;
  revenus: number;
  depenses: number;
  capacite: number;
  depensesExceptionnelles: number;
  encaissements: number;
  remboursementsAnticipes: number;
  rendements: number;
  abondement: number;
  variationPatrimoine: number;
  patrimoineFin: number;
}

export interface ProjectionControle {
  id: string;
  libelle: string;
  ok: boolean;
}

export interface ProjectionRapport {
  scenarioAfficheId: string;
  retraite: ProjectionRetraiteScenario[];
  synthese: ProjectionSyntheseScenario[];
  evolution: ProjectionEvolutionAnnee[];
  phases: ProjectionPhaseMoyenne[];
  annees: ProjectionAnneeDetail[];
  /** Résultats mois par mois du scénario affiché (budget mensuel du foyer). */
  mois: ProjectionMoisResultat[];
  controles: ProjectionControle[];
  pointsAConfirmer: ProjectionPointAConfirmer[];
}

// ─── Projections — calculateurs (lot 2) ───
/** Paramètres utilisateur du calculateur fiscal (IR du foyer et taux PAS par année). */
export interface ProjectionFiscalParams {
  /** Indexation annuelle du barème et de la grille : inflation du scénario ou taux saisi. */
  indexationBareme: { mode: 'inflation' | 'manuel'; manuel?: number };
  /** Âge limite de rattachement d'un enfant, au 1er janvier (½ part tant qu'il est plus jeune). */
  ageLimiteRattachement: number;
  /** true = taux individualisés par personne ; false = taux commun du foyer. */
  tauxIndividualises: boolean;
  /** Avant cette année, les taux réels saisis s'appliquent ; à partir d'elle, les taux sont recalculés. */
  premiereAnneeRecalculee: number;
  /** Taux de prélèvement à la source réellement appliqués aujourd'hui (décimaux, 0.07 = 7 %). */
  tauxReelsActuels: { p1: number; p2: number };
  /** true (défaut) : IR du libéral = taux PAS recalculé × BNC imposable ; false : IR imputé de ② (⑫ B15). */
  irLiberalParTaux?: boolean;
}

/** Résultat fiscal d'une année civile du foyer. */
export interface ProjectionFiscalAnnee {
  annee: number;
  /** Parts fiscales du foyer (2 + ½ par enfant rattaché au 1er janvier). */
  parts: number;
  /** Revenu net imposable du foyer, annualisé, après abattements de 10 %. */
  revenuNetImposable: number;
  /** Impôt sur le revenu net du foyer (après plafonnement du quotient familial et décote). */
  irNet: number;
  /** Taux moyen du foyer, arrondi au 1/1000. */
  tauxFoyer: number;
  /** Taux de prélèvement à la source appliqué à la personne 1 (décimal). */
  tauxP1: number;
  /** Taux de prélèvement à la source appliqué à la personne 2 (décimal). */
  tauxP2: number;
}

/** Paramètres de retraite d'une personne (CNAV, Agirc-Arrco, Cipav, rente PER). Montants en € de l'année de référence. */
export interface ProjectionRetraitePersonneParams {
  personneId: string;
  /** Trimestres validés (régime général) à la date du relevé. */
  trimestresValides: number;
  /** Dernière année civile entièrement couverte par le relevé (trimestres et points acquis). */
  anneeReleve: number;
  /** Trimestres requis pour le taux plein (selon la génération). */
  trimestresRequis: number;
  /** Points Agirc-Arrco acquis au relevé. */
  pointsAgircArrco: number;
  /** Valeur de service du point Agirc-Arrco (€). */
  valeurPointAgircArrco: number;
  /** Prix d'achat du point Agirc-Arrco = salaire de référence (€). */
  prixPointAgircArrco: number;
  /** Points Cipav acquis par an pour un BNC égal à `bncReferenceCipav`. */
  pointsCipavParAn: number;
  /** BNC annuel de référence correspondant à `pointsCipavParAn` (€). */
  bncReferenceCipav: number;
  /** Valeur du point Cipav (€). */
  valeurPointCipav: number;
  /** Rente PER / épargne retraite (€ brut par mois). */
  rentePerMensuelle: number;
  /** CSG/CRDS/CASA du retraité (décimal, 0.091 = 9,1 %). */
  tauxPrelevementsSociaux: number;
  /** Revalorisation annuelle des salaires portés au compte (décimal). */
  revalorisationSalaires: number;
  /** Croissance annuelle du PASS (décimal). */
  croissancePass: number;
  /** Nombre de meilleures années retenues pour le SAM (25). */
  nombreMeilleuresAnnees: number;
  /** Salaires bruts annuels connus (relevé), par année civile. Priment sur la carrière projetée. */
  salairesPasses?: Record<string, number>;
}

/** Paramètres de retraite du foyer : une entrée par personne. */
export interface ProjectionRetraiteParams {
  personnes: ProjectionRetraitePersonneParams[];
  /** Part déductible de la CSG sur les pensions (décimal) ; défaut : constante légale. */
  partCsgDeductible?: number;
}

/** Revenus de carrière d'une année civile (entrée du calculateur de retraite). */
export interface ProjectionRetraiteCarriereAnnee {
  annee: number;
  /** Salaire brut annuel soumis au régime général (CNAV). */
  salaireRG?: number;
  /** Assiette Agirc-Arrco annuelle ; par défaut `salaireRG`. */
  assietteAgircArrco?: number;
  /** Points Agirc-Arrco calculés en amont (ex. congé de reclassement) : remplacent ceux de l'assiette. */
  pointsAgircArrco?: number;
  /** BNC annuel (affilié Cipav). */
  bnc?: number;
}

/** Pension de retraite d'une personne à la liquidation (€ par mois, de l'année de référence). */
export interface ProjectionRetraiteResultat {
  detailBrut: { cnav: number; agircArrco: number; cipav: number; per: number };
  totalBrut: number;
  netAvantImpot: number;
  trimestres: { regimeGeneral: number; autresRegimes: number; total: number; manquants: number };
  /** Valeurs intermédiaires : SAM annuel, années retenues, taux, proratisation, points totaux. */
  sam: number;
  anneesRetenues: number;
  tauxLiquidation: number;
  coefficientProratisation: number;
  pointsAgircArrco: number;
  pointsCipav: number;
}

/** Nature d'un poste de charges libérales : proratisé au nombre de mesures, coefficient CFE ou fixe. */
export type ProjectionChargeLiberaleNature = 'fixe' | 'variable' | 'cfe';

/** Poste de charges du cabinet libéral, au budget de référence (€/an, `mesuresReference` mesures). */
export interface ProjectionChargeLiberale {
  libelle: string;
  montantReference: number;
  nature: ProjectionChargeLiberaleNature;
}

/** Paramètres utilisateur du calculateur d'activité de la personne 1 (salaire, congé, ARE, CCN 66, libéral). */
export interface ProjectionActiviteParams {
  personne1: { dateNaissance: string; ageDepartRetraite: number };
  /** Paie validée d'un mois normal, versée `moisPayesParAn` fois par an (lissée sur 12 mois). */
  paie: {
    netAvantPas: number;
    netImposable: number;
    moisPayesParAn: number;
    /** Ratio net imposable / net versé des revenus de remplacement (allocation de reclassement, ARE). */
    ratioImposableRemplacement: number;
  };
  /** Dates en YYYY-MM-DD. Le préavis court dans le congé de reclassement (fin du contrat = fin du congé). */
  calendrier: {
    dateNotification: string;
    delaiReflexionJours: number;
    dureePreavisMois: number;
    dureeCongeMois: number;
    debutAssociation: string;
    /** Bascule en libéral (scénarios avec mesures cibles > 0). */
    dateBasculeLiberal: string;
  };
  reclassement: {
    /** Part du brut mensuel de référence versée pendant le congé (0.7 = 70 %). */
    tauxAllocation: number;
    /** Brut mensuel de référence (13e mois inclus, ÷ 12). */
    brutMensuelReference: number;
    /** Assiette mensuelle Agirc-Arrco maintenue pendant le congé (clause de l'accord). */
    assietteAgircArrcoMensuelle: number;
  };
  /** SJR et assiettes des différés d'indemnisation (supra-légal + transactionnel brut ; ICCP brute). */
  are: { sjr: number; assietteSupralegale: number; iccpBrute: number };
  ccn66: {
    coefficient: number;
    valeurPoint: number;
    /** Complément de traitement indiciaire (€ brut/mois), exclu du test SMIC. */
    cti: number;
    tauxCotisationsSalariales: number;
    progressionAnnuelle: number;
  };
  liberal: {
    tarifMesure: number;
    /** Part des mesures cibles atteinte aux années 1, 2 et 3+ de la montée en charge. */
    monteeEnCharge: [number, number, number];
    mesuresReference: number;
    charges: ProjectionChargeLiberale[];
    /** Coefficient appliqué aux postes « cfe » (années 1, 2 et 3+). */
    coefficientCfe: [number, number, number];
    perAnnuel: number;
    /** true (défaut) : le PER TNS est une sortie de cash du mois (①b B84). */
    perSortieDeCash?: boolean;
    /** Taux maladie-maternité par année de montée en charge ; défaut : constantes légales. */
    tauxMaladieMaternite?: [number, number, number];
  };
  /** Mesures cibles par id de scénario (0 ou absent = pas de libéral : association jusqu'à la retraite). */
  scenarios: Record<string, number>;
  /** Foyer pour l'IR imputé au libéral (②) : revenu imposable de l'autre personne et parts. */
  irImpute?: { revenuImposableAutrePersonne: number; parts: number };
  /** Personne 2 : salaire lissé revalorisé chaque 1er janvier jusqu'à la fin d'activité. */
  personne2?: {
    dateNaissance: string;
    ageFinActivite: number;
    netAvantPasMensuel: number;
    netImposableMensuel: number;
    /** Salaire brut annuel à l'année de référence (①b B19) : sert à la carrière retraite ; absent = pas de pension. */
    salaireBrutAnnuel?: number;
    revalorisationAnnuelle: number;
    /** Année de la paie de référence (indice = 1 cette année-là). */
    anneeReference: number;
  };
}

/** Revenus d'activité de la personne 1 pour un mois (€/mois ; pensions de retraite exclues). */
export interface ProjectionActiviteMois {
  mois: ProjectionMonth;
  /** Libellé de phase (colonne B des onglets Calc) ; « Retraite » une fois l'âge de départ passé. */
  phase: string;
  /** Code de phase (colonne AF) : 1 emploi, 2 congé, 3 association, 4 association sans ARE, 5 à 7 libéral, 8 retraite. */
  codePhase: number;
  /** Net avant PAS, libéral inclus (colonne C). */
  netAvantPas: number;
  /** Net imposable : salaires, remplacement et BNC imposable (colonne D = AY + BA). */
  netImposable: number;
  /** Net imposable hors libéral (colonne AY). */
  netImposableHorsLiberal: number;
  /** BNC imposable après cotisations et PER (colonne BA). */
  bncImposable: number;
  /** Libéral : BNC − cotisations (colonne AZ). */
  liberalNetAvantImpot: number;
  /** Libéral : IR imputé selon ② (colonne BB). */
  liberalIrImpute: number;
  /** Versement PER TNS du mois, positif (colonne BC = −per). */
  per: number;
  /** Revenu manquant avant PAS : complément ARE pendant le différé + salaire pendant le trou. */
  revenuManquantNet: number;
  /** Assiette imposable du revenu manquant. */
  revenuManquantImposable: number;
  /** Revenu manquant après PAS (colonne R), avec le taux PAS de l'année s'il est fourni, sinon 0 %. */
  revenuManquant: number;
  /** Fractions du mois (colonnes AI à AP) et année d'association (AQ). */
  fractions: {
    emploi: number;
    conge: number;
    trou: number;
    association: number;
    liberal: number;
    arePlein: number;
    areDegressif: number;
    differeAre: number;
  };
  anneeAssociation: number;
  /** Net mensuel du salaire d'association (colonne AR). */
  netSalaireAssociation: number;
  /** Personne 2 : net avant PAS et net imposable du salaire revalorisé (colonnes H et I, hors pension). */
  netAvantPasPersonne2: number;
  netImposablePersonne2: number;
}

/** Sortie de l'assemblage des calculateurs pour un scénario (utils/projection/calculateurs). */
export interface ProjectionScenarioCalcule {
  /** Cash mensuel après PAS (€ courants) par personne. */
  revenusMensuels: Record<string, Record<ProjectionMonth, number>>;
  retraiteDetail: Record<string, ProjectionRetraiteResultat>;
  /** Libellé de phase de la personne 1 pour chaque mois. */
  phasesMensuelles: Record<ProjectionMonth, string>;
  /** 1er mois de pension par personne. */
  debutsRetraite: Record<string, ProjectionMonth>;
  fiscal: ProjectionFiscalAnnee[];
}

// ─── Journal des modifications (collection `audit_log`) ───
export type AuditDomain = 'transaction' | 'budget' | 'recurrence';
export type AuditAction = 'create' | 'update' | 'delete';
export type AuditValue = string | number | boolean | null;

/** Un champ modifié : `from` absent si l'ancienne valeur est inconnue. */
export interface AuditChange {
  field: string;
  from?: AuditValue;
  to?: AuditValue;
}

export interface AuditEntry {
  id: string;
  /** `null` tant que l'horodatage serveur n'est pas connu. */
  at: Date | null;
  byEmail: string;
  domain: AuditDomain;
  action: AuditAction;
  /** Chemin Firestore du document modifié, ex. `transactions/abc`. */
  path: string;
  docId: string;
  label: string;
  changes: AuditChange[];
}
