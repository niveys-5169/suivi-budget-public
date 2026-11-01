/** Calendrier de la carrière (① B88:B96, ①b B76:B83, Calc B320:B322) et fractions de mois (Calc AI:AP). */
import type {
  ProjectionActiviteMois,
  ProjectionActiviteParams,
} from '../../../types/banking.types';
import { JOURS_MOYENS_PAR_MOIS } from './constants';
import { dayNumber, edate, parseDay } from './dates';

/** Dates clés en numéros de jour (voir `dates.ts`). */
export interface Calendrier {
  /** Fin du préavis : jusqu'ici, salaire à 100 % (① B90). */
  finPreavis: number;
  /** Fin du congé de reclassement = fin du contrat (① B93). */
  finConge: number;
  /** 1er versement ARE : fin du contrat + différés + 1 (① B96). */
  premierVersementAre: number;
  debutAssociation: number;
  /** Début du complément ARE : MAX(1er versement ; embauche) (①b B81). */
  debutComplement: number;
  /** 1er jour du mois d'anniversaire de l'âge de départ : dernier mois d'activité (①b B119). */
  moisDepartRetraite: number;
  /** Bascule en libéral ; sans libéral, 1er mois de retraite (Calc B320). */
  bascule: number;
  finComplement: number;
  finPleinTarif: number;
}

export interface CalendrierInput {
  params: ProjectionActiviteParams;
  /** Mesures cibles du scénario (0 = pas de libéral). */
  mesuresCibles: number;
  /** Total des différés d'indemnisation en jours (① B43). */
  differesJours: number;
  /** Durées du complément ARE en mois (②b B28, B30). */
  dureePleinMois: number;
  dureeTotaleMois: number;
}

export function computeCalendrier(input: CalendrierInput): Calendrier {
  const { personne1, calendrier } = input.params;
  const debutConge = parseDay(calendrier.dateNotification) + calendrier.delaiReflexionJours;
  const finConge = edate(debutConge, calendrier.dureeCongeMois);
  const premierVersementAre = finConge + input.differesJours + 1;
  const debutAssociation = parseDay(calendrier.debutAssociation);
  const debutComplement = Math.max(premierVersementAre, debutAssociation);
  const [anneeNaissance = 0, moisNaissance = 1] = personne1.dateNaissance.split('-').map(Number);
  const moisDepartRetraite = dayNumber(
    anneeNaissance + personne1.ageDepartRetraite,
    moisNaissance,
    1,
  );
  const bascule =
    input.mesuresCibles > 0
      ? parseDay(calendrier.dateBasculeLiberal)
      : edate(moisDepartRetraite, 1);
  const finComplement = Math.min(
    premierVersementAre + input.dureeTotaleMois * JOURS_MOYENS_PAR_MOIS,
    bascule,
  );
  return {
    finPreavis: edate(debutConge, calendrier.dureePreavisMois),
    finConge,
    premierVersementAre,
    debutAssociation,
    debutComplement,
    moisDepartRetraite,
    bascule,
    finComplement,
    finPleinTarif: Math.min(
      finComplement,
      debutComplement + input.dureePleinMois * JOURS_MOYENS_PAR_MOIS,
    ),
  };
}

export type FractionsMois = ProjectionActiviteMois['fractions'];

/** Part du mois [debut, debut + jours[ comprise dans [de, a[ (bornes en numéros de jour). */
const part = (debut: number, fin: number, de: number, a: number): number =>
  Math.max(0, Math.min(fin, a) - Math.max(debut, de)) / (fin - debut);

/** Fractions de mois jour par jour (Calc AI:AP). `retraite` annule association et libéral (× (1 − BE)). */
export function fractionsMois(debut: number, cal: Calendrier, retraite: boolean): FractionsMois {
  const fin = edate(debut, 1);
  const actif = retraite ? 0 : 1;
  return {
    emploi: part(debut, fin, -Infinity, cal.finPreavis),
    conge: part(debut, fin, cal.finPreavis, cal.finConge),
    trou: part(debut, fin, cal.finConge, cal.debutAssociation),
    association: part(debut, fin, cal.debutAssociation, cal.bascule) * actif,
    liberal: part(debut, fin, cal.bascule, Infinity) * actif,
    arePlein: part(debut, fin, cal.debutComplement, cal.finPleinTarif),
    areDegressif: part(debut, fin, cal.finPleinTarif, cal.finComplement),
    differeAre: part(debut, fin, cal.debutAssociation, cal.debutComplement),
  };
}
