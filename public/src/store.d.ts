import { Firestore } from 'firebase/firestore';

export interface GlobalStoreState {
  db: Firestore | null;
  userId: string | null;
  TX_LOAD_ALL: boolean;
  ACCOUNT_BALANCES: unknown[]; // Keep for legacy
  LINXO_MAPPINGS: Record<string, unknown>[];
  GMAIL_MESSAGES: Record<string, unknown>[];
  CATEGORY_STYLES: Record<string, { bg: string; color: string; icon: string }>;
  BUDGET_DEFAULTS: Record<string, number>;
  [key: string]: unknown;
}

export const state: GlobalStoreState;
export function setState(newState: Partial<GlobalStoreState>): void;
export function patchState(patch: Partial<GlobalStoreState>): void;
