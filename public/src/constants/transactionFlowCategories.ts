/** Libellés canoniques partagés pour neutraliser les flux purement patrimoniaux. */
export const SAVINGS_DEPOSIT_CATEGORY_ALIASES = [
  'Epargne',
  'Épargne',
  'Versement Epargne',
  'Versement Épargne',
  'Versements Epargne',
  'Versements Épargne',
] as const;

export const SAVINGS_WITHDRAWAL_CATEGORY_ALIASES = [
  'Retrait Epargne',
  'Retrait Épargne',
  'Retraits epargne',
  'Retraits épargne',
] as const;

export const INTERNAL_TRANSFER_CATEGORY_ALIASES = [
  'Virement interne',
  'Virements internes',
] as const;

export const PATRIMONIAL_FLOW_CATEGORY_ALIASES = [
  ...INTERNAL_TRANSFER_CATEGORY_ALIASES,
  ...SAVINGS_DEPOSIT_CATEGORY_ALIASES,
  ...SAVINGS_WITHDRAWAL_CATEGORY_ALIASES,
] as const;

export const normalizeFlowCategory = (value: string | undefined): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('fr');
