import { deleteField } from 'firebase/firestore';
import type { BudgetBase } from '../types/banking.types';
import type { BudgetFormValues } from './schemas/forms';

/**
 * Logique partagée des formulaires budget (desktop `BudgetFormModal` et mobile
 * `MBudgetFormModal`) : valeurs par défaut, dérivation de période et payload
 * Firestore. Les deux interfaces DOIVENT passer par ce module pour écrire un
 * budget — c'est la seule garantie que les documents restent cohérents quel
 * que soit l'appareil de saisie.
 */

/** Type de période cohérent avec le type de budget. */
export const periodeTypeFor = (
  type: BudgetFormValues['type'],
): BudgetFormValues['periode']['type'] =>
  type === 'mensuel' ? 'mois_courant' : type === 'annuel' ? 'annee_civile' : 'custom';

/** Valeurs de formulaire complètes depuis un budget existant (ou vierges). */
export const buildBudgetDefaults = (budget?: BudgetBase): BudgetFormValues => ({
  nom: budget?.nom ?? '',
  categorie: budget?.categorie ?? '',
  type: (budget?.type as BudgetFormValues['type']) ?? 'mensuel',
  montant: budget?.montant ?? 0,
  actif: budget?.actif ?? true,
  sens: budget?.isIncome === true ? 'entree' : budget?.isIncome === false ? 'sortie' : 'auto',
  moisAttendus: budget?.moisAttendus ?? [],
  compte: budget?.compte ?? null,
  periode: {
    type:
      (budget as unknown as { periode?: { type: BudgetFormValues['periode']['type'] } })?.periode
        ?.type ?? 'mois_courant',
    debut: (budget as unknown as { periode?: { debut: string } })?.periode?.debut ?? '',
    fin: (budget as unknown as { periode?: { fin: string } })?.periode?.fin ?? '',
  },
});

/**
 * Payload Firestore canonique depuis des valeurs validées par `budgetFormSchema`.
 * `sens: 'auto'` supprime le champ `isIncome` (deleteField) pour laisser jouer
 * l'auto-détection côté lecture.
 */
export function buildBudgetPayload(values: BudgetFormValues): Record<string, unknown> {
  const { sens, ...rest } = values;
  return {
    ...rest,
    isIncome: sens === 'entree' ? true : sens === 'sortie' ? false : deleteField(),
  };
}
