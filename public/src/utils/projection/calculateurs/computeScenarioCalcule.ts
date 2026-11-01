/**
 * Assemblage des calculateurs pour un scénario, dans l'ordre du classeur (⑤b / Calc) :
 * activité P1 (colonnes B à D) → carrière annuelle (③b) → retraite P1 et P2 (③b, ③c) → pensions
 * mensuelles (BF à BI) → entrées fiscales annuelles (⑫ B, D, E, G) → taux PAS → cash mensuel (G, L).
 */
import type {
  ProjectionMonth,
  ProjectionParams,
  ProjectionScenarioCalcule,
} from '../../../types/banking.types';
import { computeActivitePersonne1 } from '../activite/computeActivite';
import { computeFiscalParAnnee } from '../fiscal/computeFiscal';
import { CSG_DEDUCTIBLE_PENSIONS_DEFAUT } from '../retraite/constants';
import { yearOf } from '../projectionMonths';
import { anneesFiscales, ajouterPensions } from './moisCalcules';
import { retraitesScenario } from './retraiteScenario';

/** Blocs de paramètres manquants (libellés lisibles) : vide si le calcul est possible. */
export function blocsManquants(params: ProjectionParams): string[] {
  const calc = params.calculateurs;
  const manque: string[] = [];
  if (!calc?.fiscal) manque.push('fiscal');
  if (!calc?.activite) manque.push('activité');
  if (!calc?.retraite) manque.push('retraite');
  else if (!calc.retraite.personnes.some((p) => p.personneId === params.personnes[0]?.id))
    manque.push('retraite de la personne 1');
  return manque;
}

/** Calcule les revenus mensuels après PAS des personnes ; undefined si un bloc de paramètres manque. */
export function computeScenarioCalcule(
  params: ProjectionParams,
  scenarioId: string,
  horizon: Pick<ProjectionParams['horizon'], 'debut' | 'fin'> = params.horizon,
): ProjectionScenarioCalcule | undefined {
  if (blocsManquants(params).length > 0) return undefined;
  const { fiscal, retraite, activite: act } = params.calculateurs!;
  const ids = { p1: params.personnes[0]!.id, p2: params.personnes[1]?.id };
  const retraites = retraitesScenario(act!, retraite!, ids, scenarioId)!;
  const [naissance2 = 0, moisNaissance2 = 1] = (act!.personne2?.dateNaissance ?? '')
    .split('-')
    .map(Number);

  const mois = ajouterPensions(computeActivitePersonne1({ horizon, params: act! }, scenarioId), {
    r1: retraites.p1,
    r2: retraites.p2,
    inflation: params.macro.inflation,
    anneeReferencePrix: params.horizon.anneeReferencePrix,
    csgDeductible: retraite!.partCsgDeductible ?? CSG_DEDUCTIBLE_PENSIONS_DEFAUT,
    debutPension2: act!.personne2
      ? (naissance2 + act!.personne2.ageFinActivite) * 12 + moisNaissance2 - 1
      : Infinity,
  });
  const resultatFiscal = computeFiscalParAnnee({
    annees: anneesFiscales(mois),
    enfants: params.enfants,
    indexation:
      fiscal!.indexationBareme.mode === 'manuel'
        ? (fiscal!.indexationBareme.manuel ?? 0)
        : params.macro.inflation,
    ageLimiteRattachement: fiscal!.ageLimiteRattachement,
    tauxIndividualises: fiscal!.tauxIndividualises,
    premiereAnneeRecalculee: fiscal!.premiereAnneeRecalculee,
    tauxReelsActuels: fiscal!.tauxReelsActuels,
  });
  const taux = new Map(resultatFiscal.map((f) => [f.annee, f]));
  const irParTaux = fiscal!.irLiberalParTaux ?? true;
  const perSortie = act!.liberal.perSortieDeCash ?? true;

  // Cash après PAS : G = C − F + B84 × BC (BC = −PER), F = taux × imposable + IR du libéral ; L = H − taux × I.
  const revenusMensuels: Record<string, Record<ProjectionMonth, number>> = { [ids.p1]: {} };
  const avecP2 = ids.p2 !== undefined && act!.personne2 !== undefined;
  if (avecP2) revenusMensuels[ids.p2!] = {};
  const phasesMensuelles: Record<ProjectionMonth, string> = {};
  const debutsRetraite: Record<string, ProjectionMonth> = {};
  for (const m of mois) {
    const a = m.activite;
    const f = taux.get(yearOf(a.mois));
    const pas1 =
      (f?.tauxP1 ?? 0) * (m.imposableP1 + (irParTaux ? a.bncImposable : 0)) +
      (irParTaux ? 0 : a.liberalIrImpute);
    revenusMensuels[ids.p1]![a.mois] = m.netP1 - pas1 - (perSortie ? a.per : 0);
    if (avecP2) revenusMensuels[ids.p2!]![a.mois] = m.netP2 - (f?.tauxP2 ?? 0) * m.imposableP2;
    phasesMensuelles[a.mois] = a.phase;
    if (m.retraite1) debutsRetraite[ids.p1] ??= a.mois;
    if (m.retraite2 && avecP2) debutsRetraite[ids.p2!] ??= a.mois;
  }
  const retraiteDetail = { [ids.p1]: retraites.p1 };
  return {
    revenusMensuels,
    retraiteDetail:
      retraites.p2 && ids.p2 ? { ...retraiteDetail, [ids.p2]: retraites.p2 } : retraiteDetail,
    phasesMensuelles,
    debutsRetraite,
    fiscal: resultatFiscal,
  };
}
