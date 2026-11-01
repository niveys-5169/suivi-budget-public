/** Revenus mensuels bruts des deux personnes (activité + pensions) avant PAS : colonnes C, D, H, I de Calc. */
import type {
  ProjectionActiviteMois,
  ProjectionRetraiteResultat,
} from '../../../types/banking.types';
import { CODE_PHASE } from '../activite/phases';
import type { FiscalAnneeInput } from '../fiscal/computeFiscal';
import { monthIndex, yearOf } from '../projectionMonths';

export interface MoisCalcule {
  activite: ProjectionActiviteMois;
  /** La pension de la personne est versée ce mois-là. */
  retraite1: boolean;
  retraite2: boolean;
  /** Net avant PAS : activité + pension (C, H). */
  netP1: number;
  netP2: number;
  /** Net imposable hors BNC : activité + pension imposable (AY, I). */
  imposableP1: number;
  imposableP2: number;
}

export interface PensionsContexte {
  r1: ProjectionRetraiteResultat;
  r2?: ProjectionRetraiteResultat;
  inflation: number;
  anneeReferencePrix: number;
  /** Part de CSG déductible : pension imposable = brut × (1 − part) (①b B146, B148). */
  csgDeductible: number;
  /** Rang absolu du 1er mois de pension de la personne 2 (fin d'activité). */
  debutPension2: number;
}

/**
 * Ajoute les pensions aux revenus d'activité : net indexé sur l'inflation, imposable = brut × (1 − CSG
 * déductible) ; P1 à partir du mois suivant son départ (BE, BF, BG), P2 dès sa fin d'activité (BH, BI).
 */
export function ajouterPensions(
  activite: ProjectionActiviteMois[],
  ctx: PensionsContexte,
): MoisCalcule[] {
  return activite.map((a) => {
    const indice = (1 + ctx.inflation) ** (yearOf(a.mois) - ctx.anneeReferencePrix);
    const pension1 = a.codePhase === CODE_PHASE.retraite ? ctx.r1 : undefined;
    const pension2 = monthIndex(a.mois) >= ctx.debutPension2 ? ctx.r2 : undefined;
    const net = (r?: ProjectionRetraiteResultat) => (r ? r.netAvantImpot * indice : 0);
    const imposable = (r?: ProjectionRetraiteResultat) =>
      r ? r.totalBrut * (1 - ctx.csgDeductible) * indice : 0;
    return {
      activite: a,
      retraite1: pension1 !== undefined,
      retraite2: pension2 !== undefined,
      netP1: a.netAvantPas + net(pension1),
      netP2: a.netAvantPasPersonne2 + net(pension2),
      imposableP1: a.netImposableHorsLiberal + imposable(pension1),
      imposableP2: a.netImposablePersonne2 + imposable(pension2),
    };
  });
}

/** Revenus annuels sommés sur les mois projetés (⑫ B, D, E, G). */
export function anneesFiscales(mois: MoisCalcule[]): FiscalAnneeInput[] {
  const annees = new Map<number, FiscalAnneeInput>();
  for (const m of mois) {
    const annee = yearOf(m.activite.mois);
    const cur = annees.get(annee) ?? {
      annee,
      moisProjetes: 0,
      imposableP1: 0,
      bncP1: 0,
      imposableP2: 0,
    };
    cur.moisProjetes += 1;
    cur.imposableP1 += m.imposableP1;
    cur.bncP1 += m.activite.bncImposable;
    cur.imposableP2 += m.imposableP2;
    annees.set(annee, cur);
  }
  return [...annees.values()];
}
