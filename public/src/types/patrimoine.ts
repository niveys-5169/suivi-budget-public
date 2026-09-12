import type { FirestoreDateLike } from './banking.types';

export interface OwnerSnapshot {
  courants: number;
  epargne: number;
  bourse?: number;
  per?: number;
  investissements?: number;
  retraite?: number;
  total: number;
}

export interface PatrimoineSnapshot {
  monthKey: string;
  date: string;
  owners: Record<string, OwnerSnapshot>;
}

export interface PlacementSnapshot {
  montant: number;
  date: Date;
}

export interface WealthHistoryEntry {
  id?: string;
  placementId?: string;
  assetId?: string;
  date: string; // ISO — aligns with RawHistoryEntry
  montant?: number;
  amount?: number;
  value?: number;
  owner?: string;
  type?: string;
  createdAt?: FirestoreDateLike;
  nom?: string;
  category?: string;
  /** Tolère les champs supplémentaires des documents Firestore (ex. `source`). */
  [key: string]: unknown;
}
