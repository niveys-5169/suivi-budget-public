import type {
  ProjectionActiviteParams,
  ProjectionFiscalParams,
  ProjectionParams,
  ProjectionRetraiteParams,
  ProjectionRetraitePersonneParams,
} from '../../../types/banking.types';
import {
  AGIRC_ARRCO_PRIX_POINT_DEFAUT,
  AGIRC_ARRCO_VALEUR_SERVICE_DEFAUT,
  CSG_DEDUCTIBLE_PENSIONS_DEFAUT,
  NOMBRE_MEILLEURES_ANNEES,
  TAUX_PRELEVEMENTS_SOCIAUX_DEFAUT,
} from '../retraite/constants';
import { yearOf } from '../projectionMonths';

type Calculateurs = NonNullable<ProjectionParams['calculateurs']>;

/** Trimestres requis pour le taux plein (générations nées à partir de 1965). */
const TRIMESTRES_REQUIS_DEFAUT = 172;
/** Âge de départ proposé tant qu'aucun n'est saisi (âge légal actuel). */
const AGE_DEPART_DEFAUT = 64;

/** Âge fictif proposé tant qu'une date de naissance n'est pas saisie. */
const naissanceParDefaut = (annee: number) => `${annee - 50}-01-01`;

function defaultFiscal(params: ProjectionParams): ProjectionFiscalParams {
  return {
    indexationBareme: { mode: 'inflation' },
    ageLimiteRattachement: 21,
    tauxIndividualises: true,
    premiereAnneeRecalculee: yearOf(params.horizon.debut) + 1,
    tauxReelsActuels: { p1: 0, p2: 0 },
    irLiberalParTaux: true,
  };
}

/** Paramètres de retraite d'une personne, à zéro (constantes légales publiques pour le reste). */
export function createDefaultRetraitePersonne(
  params: ProjectionParams,
  personneId: string,
): ProjectionRetraitePersonneParams {
  return {
    personneId,
    trimestresValides: 0,
    anneeReleve: yearOf(params.horizon.debut) - 1,
    trimestresRequis: TRIMESTRES_REQUIS_DEFAUT,
    pointsAgircArrco: 0,
    valeurPointAgircArrco: AGIRC_ARRCO_VALEUR_SERVICE_DEFAUT,
    prixPointAgircArrco: AGIRC_ARRCO_PRIX_POINT_DEFAUT,
    pointsCipavParAn: 0,
    bncReferenceCipav: 0,
    valeurPointCipav: 0,
    rentePerMensuelle: 0,
    tauxPrelevementsSociaux: TAUX_PRELEVEMENTS_SOCIAUX_DEFAUT,
    revalorisationSalaires: params.macro.inflation,
    croissancePass: params.macro.inflation,
    nombreMeilleuresAnnees: NOMBRE_MEILLEURES_ANNEES,
  };
}

function defaultRetraite(params: ProjectionParams): ProjectionRetraiteParams {
  return {
    partCsgDeductible: CSG_DEDUCTIBLE_PENSIONS_DEFAUT,
    personnes: params.personnes.slice(0, 2).map((p) => createDefaultRetraitePersonne(params, p.id)),
  };
}

/** Bloc « personne 2 » de l'activité, à zéro ; `undefined` si le foyer n'a qu'une personne. */
export function createDefaultPersonne2(
  params: ProjectionParams,
): ProjectionActiviteParams['personne2'] {
  const p2 = params.personnes[1];
  if (!p2) return undefined;
  const annee = yearOf(params.horizon.debut);
  return {
    dateNaissance: p2.dateNaissance ?? naissanceParDefaut(annee),
    ageFinActivite: p2.ageFinActivite ?? AGE_DEPART_DEFAUT,
    netAvantPasMensuel: 0,
    netImposableMensuel: 0,
    salaireBrutAnnuel: 0,
    revalorisationAnnuelle: params.macro.inflation,
    anneeReference: params.horizon.anneeReferencePrix,
  };
}

function defaultActivite(params: ProjectionParams): ProjectionActiviteParams {
  const [p1] = params.personnes;
  const debut = `${params.horizon.debut}-01`;
  const personne2 = createDefaultPersonne2(params);
  return {
    personne1: {
      dateNaissance: p1?.dateNaissance ?? naissanceParDefaut(yearOf(params.horizon.debut)),
      ageDepartRetraite: p1?.ageFinActivite ?? AGE_DEPART_DEFAUT,
    },
    paie: { netAvantPas: 0, netImposable: 0, moisPayesParAn: 12, ratioImposableRemplacement: 1 },
    calendrier: {
      dateNotification: debut,
      delaiReflexionJours: 0,
      dureePreavisMois: 0,
      dureeCongeMois: 0,
      debutAssociation: debut,
      dateBasculeLiberal: `${params.horizon.fin}-01`,
    },
    reclassement: { tauxAllocation: 0, brutMensuelReference: 0, assietteAgircArrcoMensuelle: 0 },
    are: { sjr: 0, assietteSupralegale: 0, iccpBrute: 0 },
    ccn66: {
      coefficient: 0,
      valeurPoint: 0,
      cti: 0,
      tauxCotisationsSalariales: 0,
      progressionAnnuelle: params.macro.inflation,
    },
    liberal: {
      tarifMesure: 0,
      monteeEnCharge: [1, 1, 1],
      mesuresReference: 0,
      charges: [],
      coefficientCfe: [1, 1, 1],
      perAnnuel: 0,
      perSortieDeCash: true,
    },
    scenarios: Object.fromEntries(params.scenarios.map((s) => [s.id, 0])),
    ...(personne2 ? { personne2 } : {}),
  };
}

/**
 * Paramètres génériques des calculateurs (montants à zéro, constantes légales publiques), à compléter
 * par l'utilisateur ou par l'import du classeur. Les blocs déjà présents sont conservés.
 */
export function createDefaultCalculateurs(params: ProjectionParams): Calculateurs {
  const existing = params.calculateurs;
  return {
    actif: existing?.actif ?? false,
    fiscal: existing?.fiscal ?? defaultFiscal(params),
    retraite: existing?.retraite ?? defaultRetraite(params),
    activite: existing?.activite ?? defaultActivite(params),
  };
}
