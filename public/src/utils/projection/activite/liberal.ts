/** Activité libérale MJPM : CA, charges proratisées, cotisations Cipav, BNC, PER et IR imputé (② B4:B75). */
import type {
  ProjectionActiviteParams,
  ProjectionChargeLiberale,
} from '../../../types/banking.types';
import { BAREME_IR_IMPUTE, COTISATIONS_LIBERAL, PASS_ANNUEL } from './constants';

type LiberalParams = ProjectionActiviteParams['liberal'];
type IrFoyer = NonNullable<ProjectionActiviteParams['irImpute']>;

/** Résultat annuel de l'une des trois années de montée en charge (colonnes B, C, D de ②). */
export interface LiberalAnnee {
  mesures: number;
  caAnnuel: number;
  charges: number;
  bnc: number;
  cotisations: number;
  /** BNC pour l'IR : BNC − cotisations − PER (② ligne 61). */
  bncImposable: number;
  /** Part de l'IR du foyer imputée à la personne 1 (② ligne 67). */
  irImpute: number;
}

/** Arrondi de tableur (demi vers le haut, bruit flottant écarté). */
export const arrondiTableur = (x: number): number => Math.round(Number(x.toPrecision(15)));

/** Charges annuelles : « variable » proratisé aux mesures, « cfe » × coefficient, « fixe » telle quelle (② B12:B28). */
export function chargesAnnuelles(
  charges: ProjectionChargeLiberale[],
  mesures: number,
  mesuresReference: number,
  coefficientCfe: number,
): number {
  return charges.reduce((total, { montantReference, nature }) => {
    if (nature === 'variable') return total + (montantReference * mesures) / mesuresReference;
    return total + (nature === 'cfe' ? montantReference * coefficientCfe : montantReference);
  }, 0);
}

/** Cotisations sociales Cipav sur l'assiette BNC × 74 % (② B48:B55). Négatives si le BNC est négatif. */
export function cotisationsLiberal(bnc: number, tauxMaladieMaternite: number): number {
  const c = COTISATIONS_LIBERAL;
  const assiette = bnc * c.assietteBnc;
  const sousPass = Math.min(assiette, PASS_ANNUEL);
  return (
    assiette * c.maladieIj +
    assiette * tauxMaladieMaternite +
    sousPass * c.retraiteBasePlafonnee +
    assiette * c.retraiteBaseDeplafonnee +
    sousPass * c.retraiteComplementairePlafonnee +
    Math.max(0, assiette - PASS_ANNUEL) * c.retraiteComplementaireAuDessus +
    assiette * c.invaliditeDeces +
    assiette * c.allocationsFamiliales +
    assiette * c.csgCrds
  );
}

/** IR du foyer au barème de ② (quotient familial, sans plafonnement ni décote) (② B64:B66). */
export function irFoyerImpute(revenuImposable: number, parts: number): number {
  const quotient = revenuImposable / parts;
  let impot = 0;
  BAREME_IR_IMPUTE.forEach((tranche, i) => {
    const suivante = BAREME_IR_IMPUTE[i + 1]?.seuil ?? Infinity;
    if (quotient > tranche.seuil)
      impot += (Math.min(quotient, suivante) - tranche.seuil) * tranche.taux;
  });
  return impot * parts;
}

/** Calcule les trois années (montée en charge) pour un nombre de mesures cibles. */
export function computeLiberalAnnees(
  liberal: LiberalParams,
  mesuresCibles: number,
  foyer?: IrFoyer,
): LiberalAnnee[] {
  const tauxMm = liberal.tauxMaladieMaternite ?? COTISATIONS_LIBERAL.maladieMaternitePourAnnee;
  return liberal.monteeEnCharge.map((part, i) => {
    const mesures = arrondiTableur(mesuresCibles * part);
    const caAnnuel = mesures * liberal.tarifMesure * 12;
    const charges = chargesAnnuelles(
      liberal.charges,
      mesures,
      liberal.mesuresReference,
      liberal.coefficientCfe[i] ?? 1,
    );
    const bnc = caAnnuel - charges;
    const cotisations = cotisationsLiberal(bnc, tauxMm[i] ?? 0);
    const bncImposable = bnc - cotisations - liberal.perAnnuel;
    const rni = bncImposable + (foyer?.revenuImposableAutrePersonne ?? 0);
    const irImpute = foyer && rni > 0 ? (irFoyerImpute(rni, foyer.parts) * bncImposable) / rni : 0;
    return { mesures, caAnnuel, charges, bnc, cotisations, bncImposable, irImpute };
  });
}
