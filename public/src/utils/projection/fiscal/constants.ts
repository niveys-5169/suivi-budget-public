/**
 * Constantes LÉGALES publiques du calculateur fiscal (IR du foyer et taux PAS).
 * Aucune valeur personnelle ici : revenus, dates de naissance et taux réels sont des paramètres.
 * Reproduit les paramètres de l'onglet « ⑫ Calcul taux PAS » du classeur de simulation (B5:B16, B19:F20, A24:B43).
 */

/**
 * Barème de l'impôt sur le revenu pour 1 part, revenus 2025 (loi de finances 2026, art. 4,
 * tranches revalorisées de 0,9 %). Source : BOFiP BOI-IR-LIQ-20-10 (actualisation du 07/04/2026).
 */
export const BAREME_IR = {
  anneeRevenus: 2025,
  tranches: [
    { seuil: 0, taux: 0 },
    { seuil: 11600, taux: 0.11 },
    { seuil: 29579, taux: 0.3 },
    { seuil: 84577, taux: 0.41 },
    { seuil: 181917, taux: 0.45 },
  ],
} as const;

/** Plafond de l'avantage du quotient familial par demi-part, revenus 2025. Source : BOFiP BOI-IR-LIQ-20-10 §40. */
export const PLAFOND_AVANTAGE_QF_DEMI_PART = 1807;

/** Abattement forfaitaire de 10 % pour frais professionnels, par personne, revenus 2025. */
export const ABATTEMENT_10_POUR_CENT = { taux: 0.1, minimum: 509, maximum: 14555 } as const;

/**
 * Décote pour un couple : forfait − coefficient × impôt brut (plafonnée à l'impôt brut).
 * Le forfait de 1 483 € est ESTIMÉ (1 470 € pour les revenus 2024 × 1,009) : sans effet aux
 * niveaux de revenus d'un foyer à deux salaires.
 */
export const DECOTE_COUPLE = { forfait: 1483, coefficient: 0.4525 } as const;

/**
 * Grille de taux par défaut du prélèvement à la source (base mensuelle ≥ seuil → taux),
 * métropole, en vigueur depuis le 01/05/2026. Source : BOFiP BOI-BAREME-000037-20260407.
 */
export const GRILLE_TAUX_DEFAUT = {
  annee: 2026,
  bornes: [
    { seuilMensuel: 0, taux: 0 },
    { seuilMensuel: 1635, taux: 0.005 },
    { seuilMensuel: 1698, taux: 0.013 },
    { seuilMensuel: 1807, taux: 0.021 },
    { seuilMensuel: 1928, taux: 0.029 },
    { seuilMensuel: 2060, taux: 0.035 },
    { seuilMensuel: 2170, taux: 0.041 },
    { seuilMensuel: 2315, taux: 0.053 },
    { seuilMensuel: 2738, taux: 0.075 },
    { seuilMensuel: 3135, taux: 0.099 },
    { seuilMensuel: 3571, taux: 0.119 },
    { seuilMensuel: 4019, taux: 0.138 },
    { seuilMensuel: 4690, taux: 0.158 },
    { seuilMensuel: 5624, taux: 0.179 },
    { seuilMensuel: 7037, taux: 0.2 },
    { seuilMensuel: 8789, taux: 0.24 },
    { seuilMensuel: 12200, taux: 0.28 },
    { seuilMensuel: 16523, taux: 0.33 },
    { seuilMensuel: 25937, taux: 0.38 },
    { seuilMensuel: 55558, taux: 0.43 },
  ],
} as const;
