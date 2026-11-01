/** Carrière annuelle d'une personne pour le calculateur de retraite (③b colonnes E à N et lignes 81 à 93, ③c colonnes A à C). */
import type {
  ProjectionActiviteParams,
  ProjectionRetraiteCarriereAnnee,
  ProjectionRetraitePersonneParams,
} from '../../../types/banking.types';
import { computeCalendrier } from '../activite/calendrier';
import { JOURS_MOYENS_PAR_MOIS } from '../activite/constants';
import { civilFromDay, dayNumber } from '../activite/dates';
import { chargesAnnuelles } from '../activite/liberal';
import { brutMensuelAn1 } from '../activite/salariat';
import { AGIRC_ARRCO_TAUX_T1, AGIRC_ARRCO_TAUX_T2, PASS_REFERENCE } from '../retraite/constants';

/** Année fictive qui porte le BNC cumulé des années libérales : linéaire, sans effet sur le SAM (③b B91 × B93). */
const ANNEE_CIPAV = 2100;

export interface CarriereP1 {
  carriere: ProjectionRetraiteCarriereAnnee[];
  trimestresAutresRegimes: number;
  ageLiquidation: number;
}

/** Mois (au sens du classeur : jours ÷ 30,44) de l'année `annee` compris dans [de, a[, bornés à 0 et 12. */
function moisDansAnnee(annee: number, de: number, a: number): number {
  const fin = Math.min(dayNumber(annee + 1, 1, 1), a);
  const debut = Math.max(dayNumber(annee, 1, 1), de);
  return Math.min(12, Math.max(0, (fin - debut) / JOURS_MOYENS_PAR_MOIS));
}

/** Points Agirc-Arrco d'un mois sur une assiette mensuelle (① B165:B169 ; PASS mensuel 2026). */
function pointsParMois(assiette: number, prixPoint: number): number {
  const pass = PASS_REFERENCE / 12;
  const cotisation =
    Math.min(assiette, pass) * AGIRC_ARRCO_TAUX_T1 +
    Math.max(0, assiette - pass) * AGIRC_ARRCO_TAUX_T2;
  return cotisation / prixPoint;
}

/** BNC cumulé des années libérales : années × BNC moyen de la montée en charge (③b B91:B93). */
function bncCumuleLiberal(params: ProjectionActiviteParams, mesures: number, jours: number) {
  const { liberal } = params;
  const annees = Math.max(0, jours) / 365.25;
  if (mesures <= 0 || annees === 0) return 0;
  const [m1, m2, m3] = liberal.monteeEnCharge;
  const moyennes = (mesures * (m1 + m2 + Math.max(0, annees - 2) * m3)) / annees;
  const charges = chargesAnnuelles(liberal.charges, moyennes, liberal.mesuresReference, 1);
  return annees * (moyennes * liberal.tarifMesure * 12 - charges);
}

/** Salaires bruts de la personne 1 après le relevé : rupture, association (A) ou libéral (B), points Agirc-Arrco. */
export function carriereP1(
  params: ProjectionActiviteParams,
  retraite: ProjectionRetraitePersonneParams,
  mesuresCibles: number,
): CarriereP1 {
  const cal = computeCalendrier({
    params,
    mesuresCibles,
    differesJours: 0,
    dureePleinMois: 0,
    dureeTotaleMois: 0,
  });
  const premiere = retraite.anneeReleve + 1;
  const anneeRupture = civilFromDay(cal.finPreavis).year;
  const anneeAssociation = civilFromDay(cal.debutAssociation).year;
  const anneeDepart = civilFromDay(cal.moisDepartRetraite).year;
  const finSalarie = Math.min(cal.bascule, cal.moisDepartRetraite);
  const brutAn1 = brutMensuelAn1(params.ccn66);
  const { brutMensuelReference: brutReference } = params.reclassement;
  const prix = retraite.prixPointAgircArrco;
  const pointsConge =
    (pointsParMois(params.reclassement.assietteAgircArrcoMensuelle, prix) *
      (cal.finConge - dayNumber(premiere, 1, 1))) /
    JOURS_MOYENS_PAR_MOIS;
  const pointsAssociation =
    (pointsParMois(brutAn1, prix) * Math.max(0, finSalarie - cal.debutAssociation)) /
    JOURS_MOYENS_PAR_MOIS;

  const carriere: ProjectionRetraiteCarriereAnnee[] = [];
  for (let annee = premiere; annee <= anneeDepart; annee += 1) {
    const emploi =
      annee < anneeRupture
        ? 12 * brutReference
        : annee === anneeRupture
          ? (brutReference * Math.max(0, cal.finPreavis - dayNumber(annee, 1, 1))) /
              JOURS_MOYENS_PAR_MOIS +
            params.are.iccpBrute
          : 0;
    const brutAssociation =
      annee < anneeAssociation
        ? 0
        : brutAn1 *
          (1 + params.ccn66.progressionAnnuelle) ** Math.max(0, annee - anneeAssociation - 1);
    const salaireRG =
      emploi + moisDansAnnee(annee, cal.debutAssociation, finSalarie) * brutAssociation;
    const pointsAgircArrco =
      annee === premiere ? pointsConge : annee === premiere + 1 ? pointsAssociation : 0;
    carriere.push({ annee, salaireRG, pointsAgircArrco });
  }
  const jours = cal.moisDepartRetraite - cal.bascule;
  const bnc = bncCumuleLiberal(params, mesuresCibles, jours);
  if (bnc !== 0) carriere.push({ annee: ANNEE_CIPAV, bnc });
  const anneesLiberal =
    mesuresCibles > 0 ? Math.max(0, anneeDepart - civilFromDay(cal.bascule).year) : 0;
  return {
    carriere,
    trimestresAutresRegimes: 4 * anneesLiberal,
    ageLiquidation: params.personne1.ageDepartRetraite,
  };
}
