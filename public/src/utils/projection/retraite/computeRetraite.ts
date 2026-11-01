/** Calculateur de retraite d'une personne (CNAV + Agirc-Arrco + Cipav + PER), pur et sans état. */
import type {
  ProjectionRetraiteCarriereAnnee,
  ProjectionRetraitePersonneParams,
  ProjectionRetraiteResultat,
} from '../../../types/banking.types';
import { pensionAgircArrco, pointsAgircArrcoAnnee } from './agircArrco';
import { AGE_TAUX_PLEIN_AUTOMATIQUE } from './constants';
import {
  coefficientProratisation,
  nombreAnneesRetenues,
  pensionCnav,
  salairePorteAuCompte,
  sam,
  tauxLiquidation,
  trimestresDeLAnnee,
  trimestresManquants,
} from './cnav';
import { pensionCipav, pointsCipavAnnee } from './cipav';

export interface RetraitePersonneInput {
  params: ProjectionRetraitePersonneParams;
  /** Revenus de carrière par année civile (tous les salaires et BNC, passés comme projetés). */
  carriere: ProjectionRetraiteCarriereAnnee[];
  /** Âge à la liquidation : à 67 ans ou plus, le taux plein est automatique. */
  ageLiquidation?: number;
  /** Trimestres hors régime général (ex. Cipav) ; par défaut 1 par tranche de revenu BNC validante. */
  trimestresAutresRegimes?: number;
}

/** Passage du brut au net avant impôt : CSG/CRDS/CASA du retraité (③b ligne 98). */
export function netDepuisBrut(brut: number, tauxPrelevements: number): number {
  return brut * (1 - tauxPrelevements);
}

/** Salaires par année : les salaires passés connus (relevé) priment sur la carrière fournie. */
function salairesParAnnee(
  params: ProjectionRetraitePersonneParams,
  carriere: ProjectionRetraiteCarriereAnnee[],
) {
  const out = new Map<number, number>();
  for (const c of carriere) if (c.salaireRG !== undefined) out.set(c.annee, c.salaireRG);
  for (const [annee, salaire] of Object.entries(params.salairesPasses ?? {}))
    out.set(Number(annee), salaire);
  return out;
}

export function computeRetraitePersonne(input: RetraitePersonneInput): ProjectionRetraiteResultat {
  const { params, carriere } = input;
  const salaires = salairesParAnnee(params, carriere);
  const nouvelles = (annee: number) => annee > params.anneeReleve;

  // Régime général : trimestres, salaires portés au compte, SAM.
  let trimestresRG = params.trimestresValides;
  const portes: number[] = [];
  for (const [annee, salaire] of salaires) {
    if (nouvelles(annee)) trimestresRG += trimestresDeLAnnee(salaire);
    const porte = salairePorteAuCompte(
      salaire,
      annee,
      params.croissancePass,
      params.revalorisationSalaires,
    );
    if (porte > 0) portes.push(porte);
  }
  const trimestresBnc = carriere.reduce(
    (s, c) => s + (nouvelles(c.annee) ? trimestresDeLAnnee(c.bnc ?? 0) : 0),
    0,
  );
  const autres = input.trimestresAutresRegimes ?? trimestresBnc;
  const total = trimestresRG + autres;
  const manquants = trimestresManquants(params.trimestresRequis, total);
  const anneesRetenues = nombreAnneesRetenues(
    portes.length,
    trimestresRG,
    total,
    params.nombreMeilleuresAnnees,
  );
  const samAnnuel = sam(portes, anneesRetenues);
  const taux = tauxLiquidation(manquants, input.ageLiquidation);
  const prorata = coefficientProratisation(trimestresRG, params.trimestresRequis);

  // Agirc-Arrco : points acquis + points des années postérieures au relevé.
  const optsPoints = { ...params, prixPoint: params.prixPointAgircArrco };
  const pointsAgirc = carriere.reduce((s, c) => {
    if (!nouvelles(c.annee)) return s;
    const assiette = c.assietteAgircArrco ?? c.salaireRG ?? 0;
    return s + (c.pointsAgircArrco ?? pointsAgircArrcoAnnee(assiette, c.annee, optsPoints));
  }, params.pointsAgircArrco);

  // Cipav : points proratisés au BNC de chaque année.
  const pointsCipav = carriere.reduce(
    (s, c) => s + pointsCipavAnnee(c.bnc ?? 0, params.pointsCipavParAn, params.bncReferenceCipav),
    0,
  );

  const tauxPleinAuto = (input.ageLiquidation ?? 0) >= AGE_TAUX_PLEIN_AUTOMATIQUE;
  const abattement = tauxPleinAuto ? 0 : manquants;
  const detailBrut = {
    cnav: pensionCnav(samAnnuel, taux, prorata),
    agircArrco: pensionAgircArrco(pointsAgirc, params.valeurPointAgircArrco, abattement),
    cipav: pensionCipav(pointsCipav, params.valeurPointCipav),
    per: params.rentePerMensuelle,
  };
  const totalBrut = detailBrut.cnav + detailBrut.agircArrco + detailBrut.cipav + detailBrut.per;
  return {
    detailBrut,
    totalBrut,
    netAvantImpot: netDepuisBrut(totalBrut, params.tauxPrelevementsSociaux),
    trimestres: { regimeGeneral: trimestresRG, autresRegimes: autres, total, manquants },
    sam: samAnnuel,
    anneesRetenues,
    tauxLiquidation: taux,
    coefficientProratisation: prorata,
    pointsAgircArrco: pointsAgirc,
    pointsCipav,
  };
}
