// src/store.ts
// Centralisation de l'état global Front-End
// Refactored to use typed slices

import type { Transaction } from './types/banking.types';
import {
  AuthState,
  PortfolioState,
  TransactionsState,
  PatrimonieState,
  BudgetsState,
} from './store/types';

// Define the global state by combining slices and adding any extra fields
export interface GlobalState {
  auth: AuthState;
  portfolio: PortfolioState;
  transactions: TransactionsState;
  patrimonie: PatrimonieState;
  budgets: BudgetsState;
  // Additional fields that are not part of slices (keep as-is for compatibility)
  TX_LOAD_ALL: boolean;
  ACCOUNT_BALANCES: unknown[];
  LINXO_MAPPINGS: unknown[];
  GMAIL_MESSAGES: unknown[];
  CATEGORY_STYLES: Record<string, unknown>;
  REPARSE_JOBS: unknown[];
  EXCLUDED_EMAILS: unknown[];
  FULL_SCAN_PROGRESS_INTERVAL: ReturnType<typeof setInterval> | null;
  _advancedLoaded: boolean;
  _patrimoineLoaded: boolean;
  _placements: unknown[];
  _placementHistory: unknown[];
  _savingsBalances: unknown[];
  _portfolioValue: number;
  _editPlacementId: string | null;
  _patrimoineRepartitionChart: unknown;
  _patrimoineEvolutionChart: unknown;
  // SuiviPortefeuille fields (note: some duplicate with portfolio slice; we keep for compatibility)
  _portfolioApp: unknown;
  _portfolioDb: unknown;
  _portfolioHoldings: unknown[];
  _portfolioInstruments: Record<string, unknown>;
  _portfolioLastSync: number | null;
  _portfolioFilter: { owners: string[]; account: string };
  _portfolioExpandedRows: Set<string>;
  _portfolioExpandedAccounts: Set<string>;
  _portfolioHoldingsLoading: boolean;
  _portfolioAuthReady: Promise<unknown> | null;
  _portfolioAuthResolve: ((value: unknown) => void) | null;
  _portfolioAuthError: string | null;
  DASHBOARD_PERIOD: string;
  DASHBOARD_MONTH_KEY: string;
  DASHBOARD_CUSTOM_START: string;
  DASHBOARD_CUSTOM_END: string;
  DASHBOARD_SELECTED_CATS: Set<string>;
  DASHBOARD_CATEGORY_SIGNATURE: string;
  filtered: Transaction[];
  sortKey: string;
  sortDir: number;
  page: number;
  pendingDeleteId: string | null;
  detailTxId: string | null;
  AUTH_BOOTSTRAP_IN_PROGRESS: boolean;
  AUTH_BOOTSTRAPPED_UID: string | null;
  LAST_ERROR_STATE: unknown;
  // Budgets (already in budgets slice, but we keep duplicate? We'll rely on budgets slice only and remove duplicates later)
  // For now we keep the slice only and will not duplicate budget fields here.
}

// Initialize state
export const state: GlobalState = {
  auth: {
    userId: null,
    googleProvider: null,
  },
  portfolio: {
    _portfolioHoldings: [],
    _portfolioValue: 0,
    _portfolioLastSync: null,
  },
  transactions: {
    _transactions: [],
    _transactionsLoading: false,
    _txLoading: false,
  },
  patrimonie: {
    _advancedLoaded: false,
    _patrimoineLoaded: false,
    _placements: [],
    _placementHistory: [],
    _savingsBalances: [],
    _editPlacementId: null,
    _patrimoineRepartitionChart: null,
    _patrimoineEvolutionChart: null,
  },
  budgets: {
    BUDGET_DEFAULTS: {},
    BUDGET_MONTHLY: {},
    BUDGET_ANNUAL_HISTORY: {},
  },
  // Additional fields
  TX_LOAD_ALL: false,
  ACCOUNT_BALANCES: [],
  LINXO_MAPPINGS: [],
  GMAIL_MESSAGES: [],
  CATEGORY_STYLES: {},
  REPARSE_JOBS: [],
  EXCLUDED_EMAILS: [],
  FULL_SCAN_PROGRESS_INTERVAL: null,
  _advancedLoaded: false,
  _patrimoineLoaded: false,
  _placements: [],
  _placementHistory: [],
  _savingsBalances: [],
  _portfolioValue: 0,
  _editPlacementId: null,
  _patrimoineRepartitionChart: null,
  _patrimoineEvolutionChart: null,
  // SuiviPortefeuille
  _portfolioApp: null,
  _portfolioDb: null,
  _portfolioHoldings: [],
  _portfolioInstruments: {},
  _portfolioLastSync: null,
  _portfolioFilter: { owners: [], account: '' },
  _portfolioExpandedRows: new Set(),
  _portfolioExpandedAccounts: new Set(),
  _portfolioHoldingsLoading: false,
  _portfolioAuthReady: null,
  _portfolioAuthResolve: null,
  _portfolioAuthError: null,
  DASHBOARD_PERIOD: 'current_month',
  DASHBOARD_MONTH_KEY: (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  })(),
  DASHBOARD_CUSTOM_START: '',
  DASHBOARD_CUSTOM_END: '',
  DASHBOARD_SELECTED_CATS: new Set(),
  DASHBOARD_CATEGORY_SIGNATURE: '',
  filtered: [],
  sortKey: 'date',
  sortDir: -1,
  page: 1,
  pendingDeleteId: null,
  detailTxId: null,
  AUTH_BOOTSTRAP_IN_PROGRESS: false,
  AUTH_BOOTSTRAPPED_UID: null,
  LAST_ERROR_STATE: null,
};

// Cache Firestore (sessionStorage)
export const FSCache = {
  PREFIX: 'fscache_',
  TTL_TX: 5 * 60 * 1000,
  TTL_SLOW: 30 * 60 * 1000,

  set(key: string, data: unknown): void {
    const ttl =
      key === 'transactions' || key === 'transactions_all' ? FSCache.TTL_TX : FSCache.TTL_SLOW;

    try {
      sessionStorage.setItem(FSCache.PREFIX + key, JSON.stringify({ data, exp: Date.now() + ttl }));
    } catch {
      // quota sessionStorage dépassé — pas bloquant
    }
  },

  get(key: string): unknown {
    try {
      const raw = sessionStorage.getItem(FSCache.PREFIX + key);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (item && item.exp > Date.now()) return item.data;
      sessionStorage.removeItem(FSCache.PREFIX + key);
    } catch {
      // ignore parsing/cache errors
    }
    return null;
  },

  invalidate(...keys: string[]): void {
    keys.forEach((k) => {
      try {
        sessionStorage.removeItem(FSCache.PREFIX + k);
      } catch {
        // ignore cache errors
      }
    });
  },

  invalidateAll(): void {
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(FSCache.PREFIX))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // ignore cache errors
    }
  },
};

// Setter/getter functions remain unchanged
export function setState<K extends keyof GlobalState>(
  key: K,
  value: GlobalState[K],
): GlobalState[K] {
  state[key] = value;
  return state[key];
}

export function patchState(patch: Partial<GlobalState>): GlobalState {
  Object.assign(state, patch);
  return state;
}
