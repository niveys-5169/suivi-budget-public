import { Timestamp } from 'firebase/firestore';
import type { FirestoreDateLike } from '../types/banking.types';

/** Convertit n'importe quelle forme de date en millisecondes epoch (0 si invalide). */
export function toMillis(value: FirestoreDateLike): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') {
      return value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1e6);
    }
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formate un instant en durée relative française courte pour les badges de sync
 * (« à l'instant », « il y a 5 min », « il y a 3 h », « il y a 2 j »). Au-delà de
 * 7 jours, retourne la date courte (jj/mm/aaaa). Retourne '' si l'instant est nul.
 */
export function formatRelativeTime(ms: number, now: number = Date.now()): string {
  if (!ms) return '';
  const diff = now - ms;
  if (diff < 0) return "à l'instant";
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d <= 7) return `il y a ${d} j`;
  return new Date(ms).toLocaleDateString('fr-FR');
}
