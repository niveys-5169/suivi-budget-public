import type {
  ProjectionMonth,
  ProjectionMoisResultat,
  ProjectionSourceMois,
} from '../../types/banking.types';

/**
 * Ligne du budget mensuel du foyer : un mois, ou une période de mois consécutifs dont les flux
 * mensuels (arrondis à l'euro) sont identiques. Les flux sont mensuels ; les rendements sont
 * cumulés sur la période et le patrimoine est celui du dernier mois.
 */
export interface BudgetMensuelLigne {
  debut: ProjectionMonth;
  fin: ProjectionMonth;
  nbMois: number;
  phase: string;
  /** Théorique, relevé dans les transactions ou saisi à la main. */
  source: ProjectionSourceMois;
  revenusParPersonne: Record<string, number>;
  caf: number;
  autresRevenus: number;
  revenus: number;
  creditsFixes: number;
  depensesCourantes: number;
  depenses: number;
  capacite: number;
  /** Encaissements − dépenses exceptionnelles − remboursements anticipés. */
  fluxExceptionnels: number;
  /** Versements nets vers l'épargne relevés (information, déjà compris dans le patrimoine). */
  epargneNette: number;
  rendements: number;
  patrimoineFin: number;
}

function toLigne(m: ProjectionMoisResultat): BudgetMensuelLigne {
  return {
    debut: m.mois,
    fin: m.mois,
    nbMois: 1,
    phase: m.phase,
    source: m.source,
    revenusParPersonne: m.revenusParPersonne,
    caf: m.caf,
    autresRevenus: m.autresRevenus,
    revenus: m.revenus,
    creditsFixes: m.creditsFixes,
    depensesCourantes: m.depensesCourantes,
    depenses: m.depenses,
    capacite: m.capacite,
    fluxExceptionnels: m.encaissements - m.depensesExceptionnelles - m.remboursementsAnticipes,
    epargneNette: m.epargneNette,
    rendements: m.rendementCapital + m.rendementPatrimoine,
    patrimoineFin: m.patrimoineTotal,
  };
}

/** Clé des flux mensuels à l'euro près : deux mois de même clé s'affichent à l'identique. */
function cle(l: BudgetMensuelLigne): string {
  const r = Math.round;
  const personnes = Object.entries(l.revenusParPersonne)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, montant]) => `${id}:${r(montant)}`);
  return [
    l.phase,
    l.source,
    ...personnes,
    r(l.caf),
    r(l.autresRevenus),
    r(l.revenus),
    r(l.creditsFixes),
    r(l.depensesCourantes),
    r(l.depenses),
    r(l.capacite),
    r(l.fluxExceptionnels),
    r(l.epargneNette),
  ].join('|');
}

/** Lignes du budget mensuel ; `regrouper` fusionne les mois consécutifs aux flux identiques. */
export function buildBudgetMensuel(
  mois: ProjectionMoisResultat[],
  regrouper: boolean,
): BudgetMensuelLigne[] {
  const lignes = mois.map(toLigne);
  if (!regrouper) return lignes;
  const groupes: BudgetMensuelLigne[] = [];
  for (const ligne of lignes) {
    const precedente = groupes[groupes.length - 1];
    if (precedente && cle(precedente) === cle(ligne)) {
      precedente.fin = ligne.fin;
      precedente.nbMois += 1;
      precedente.rendements += ligne.rendements;
      precedente.patrimoineFin = ligne.patrimoineFin;
    } else {
      groupes.push({ ...ligne });
    }
  }
  return groupes;
}
