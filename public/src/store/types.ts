// src/store/types.ts
// Typed interfaces for slices of the global store

import type { GoogleAuthProvider } from 'firebase/auth';

export interface AuthState {
  userId: string | null;
  googleProvider: GoogleAuthProvider | null;
}

export interface PortfolioState {
  _portfolioHoldings: unknown[]; // Will be refined with Holding type later
  _portfolioValue: number;
  _portfolioLastSync: number | null;
  // Additional portfolio-related fields can be added here
}

export interface TransactionsState {
  _transactions: unknown[]; // Placeholder for PortfolioTx[] later
  _transactionsLoading: boolean;
  _txLoading: boolean;
}

export interface PatrimonieState {
  _advancedLoaded: boolean;
  _patrimoineLoaded: boolean;
  _placements: unknown[];
  _placementHistory: unknown[];
  _savingsBalances: unknown[];
  _editPlacementId: string | null;
  _patrimoineRepartitionChart: unknown;
  _patrimoineEvolutionChart: unknown;
}

export interface BudgetsState {
  BUDGET_DEFAULTS: Record<string, unknown>;
  BUDGET_MONTHLY: Record<string, unknown>;
  BUDGET_ANNUAL_HISTORY: Record<string, unknown>;
}

// GlobalState combines slices
export interface GlobalState {
  auth: AuthState;
  portfolio: PortfolioState;
  transactions: TransactionsState;
  patrimonie: PatrimonieState;
  budgets: BudgetsState;
  // Keep other global fields that are not sliced (e.g., TX_LOAD_ALL, etc.)
  TX_LOAD_ALL: boolean;
  ACCOUNT_BALANCES: unknown[];
  LINXO_MAPPINGS: unknown[];
  GMAIL_MESSAGES: unknown[];
  CATEGORY_STYLES: Record<string, unknown>;
  REPARSE_JOBS: unknown[];
  EXCLUDED_EMAILS: unknown[];
  FULL_SCAN_PROGRESS_INTERVAL: ReturnType<typeof setInterval> | null;
  DASHBOARD_PERIOD: string;
  DASHBOARD_MONTH_KEY: string;
  DASHBOARD_CUSTOM_START: string;
  DASHBOARD_CUSTOM_END: string;
  DASHBOARD_SELECTED_CATS: Set<string>;
  DASHBOARD_CATEGORY_SIGNATURE: string;
  filtered: unknown[];
  sortKey: string;
  sortDir: number;
  page: number;
  pendingDeleteId: string | null;
  detailTxId: string | null;
  AUTH_BOOTSTRAP_IN_PROGRESS: boolean;
  AUTH_BOOTSTRAPPED_UID: string | null;
  LAST_ERROR_STATE: unknown;
}
