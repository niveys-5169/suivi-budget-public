/** Libellés d'affichage des sources d'import de solde/transaction. */
export const SYNC_SOURCE_LABEL: Record<string, string> = {
  gmail: 'Linxo',
  linxo: 'Linxo',
  manuel: 'Manuel',
  manual: 'Manuel',
  historique: 'Historique',
  tronity: 'Tronity',
};

/** Retourne le libellé lisible d'une source (ou la source brute si inconnue). */
export function getSyncSourceLabel(source?: string): string {
  if (!source) return '';
  return SYNC_SOURCE_LABEL[source.toLowerCase()] ?? source;
}
