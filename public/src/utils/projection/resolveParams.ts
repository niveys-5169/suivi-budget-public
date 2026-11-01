import type {
  ProjectionAutoValue,
  ProjectionCreditParam,
  ProjectionCreditResolu,
  ProjectionInputs,
  ProjectionMonth,
  ProjectionParams,
  ProjectionPhaseResolue,
  ProjectionPhaseRevenu,
  ProjectionValeursObservees,
} from '../../types/banking.types';

export type AutoValueSource = 'auto' | 'manuel' | 'auto-indisponible';

/** Valeur retenue et son origine, pour l'affichage (badge Auto / Manuel). */
export function describeAutoValue(
  av: ProjectionAutoValue,
  observed: number | null,
): { valeur: number; source: AutoValueSource } {
  if (av.mode === 'manuel') return { valeur: av.manuel ?? 0, source: 'manuel' };
  if (observed === null) return { valeur: av.manuel ?? 0, source: 'auto-indisponible' };
  return { valeur: observed, source: 'auto' };
}

/** Somme des moyennes mensuelles des catégories sources (null si aucune n'est observée). */
function sumCategories(categories: string[] | undefined, observed: ProjectionValeursObservees) {
  const found = (categories ?? []).filter((c) => c in observed.moyenneMensuelleParCategorie);
  if (found.length === 0) return null;
  return found.reduce((sum, c) => sum + (observed.moyenneMensuelleParCategorie[c] ?? 0), 0);
}

function resolvePhase(
  phase: ProjectionPhaseRevenu,
  observed: ProjectionValeursObservees,
): ProjectionPhaseResolue {
  const auto = sumCategories(phase.categoriesSource, observed);
  return { ...phase, netMensuel: describeAutoValue(phase.netMensuel, auto).valeur };
}

function resolveCredit(
  param: ProjectionCreditParam,
  observed: ProjectionValeursObservees,
): ProjectionCreditResolu {
  const obs =
    param.mode === 'auto' && param.creditId ? observed.credits[param.creditId] : undefined;
  return {
    id: param.id,
    libelle: param.libelle,
    mensualite: obs ? obs.mensualite : (param.mensualiteManuelle ?? 0),
    fin: obs ? obs.fin : param.finManuelle,
    tauxAnnuel: obs ? obs.tauxAnnuel : (param.tauxAnnuelManuel ?? 0),
    ...(param.remboursementAnticipe ? { remboursementAnticipe: param.remboursementAnticipe } : {}),
  };
}

/** Mois précédant celui où l'aîné atteint `age` ans (undefined si non défini). */
function lastCafMonth(params: ProjectionParams): ProjectionMonth | undefined {
  const age = params.revenusCommuns.caf.arretAuxAnsAine;
  const naissances = params.enfants
    .map((e) => /^(\d{4})-(\d{2})/.exec(e.dateNaissance))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]) * 12 + Number(m[2]) - 1)
    .sort((a, b) => a - b);
  if (age === undefined || naissances.length === 0) return undefined;
  const index = naissances[0]! + age * 12 - 1;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Applique la règle Auto / Manuel et produit les entrées numériques du moteur. */
export function resolveProjectionParams(
  params: ProjectionParams,
  observed: ProjectionValeursObservees,
): ProjectionInputs {
  const { revenusCommuns, depenses, capital } = params;
  const dernierMois = lastCafMonth(params);
  const cafAuto = sumCategories(revenusCommuns.caf.categoriesSource, observed);
  return {
    horizon: params.horizon,
    macro: params.macro,
    personnes: params.personnes,
    phasesCommunes: revenusCommuns.phases.map((p) => resolvePhase(p, observed)),
    pensionsCommunes: revenusCommuns.pensions,
    caf: {
      montant: describeAutoValue(revenusCommuns.caf.montant, cafAuto).valeur,
      evolutionAnnuelle: revenusCommuns.caf.evolutionAnnuelle,
      ...(dernierMois ? { dernierMois } : {}),
    },
    budgetReference: describeAutoValue(depenses.budgetReference, observed.budgetReference).valeur,
    credits: depenses.credits.map((c) => resolveCredit(c, observed)),
    exceptionnelles: depenses.exceptionnelles,
    capitalInitial: capital.capitalInitial,
    encaissements: capital.encaissements,
    patrimoineDepart: describeAutoValue(capital.patrimoineDepart, observed.patrimoineHorsPer)
      .valeur,
    ...(capital.abondement ? { abondement: capital.abondement } : {}),
    scenarios: params.scenarios.map((s) => ({
      ...s,
      phases: s.phases.map((p) => resolvePhase(p, observed)),
    })),
  };
}
