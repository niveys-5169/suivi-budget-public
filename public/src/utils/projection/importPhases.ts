import type { ProjectionMonth, ProjectionPhaseRevenu } from '../../types/banking.types';

/** Valeur mensuelle (cash après PAS) d'une personne dans un onglet Calc. */
export interface MonthPoint {
  mois: ProjectionMonth;
  value: number;
}

/** Série consécutive de mois partageant le même libellé de phase. */
export interface PhaseSeries {
  libelle: string;
  points: MonthPoint[];
}

/** Découpe les lignes en séries consécutives de même libellé (libellés vides ignorés). */
export function groupSeries(rows: { mois: ProjectionMonth; libelle: string; value: number }[]) {
  const series: PhaseSeries[] = [];
  let current: PhaseSeries | undefined;
  for (const { mois, libelle, value } of rows) {
    if (!libelle) {
      current = undefined;
      continue;
    }
    if (current?.libelle !== libelle) {
      current = { libelle, points: [] };
      series.push(current);
    }
    current.points.push({ mois, value });
  }
  return series;
}

/**
 * Croissance annuelle moyenne entre les valeurs de janvier de la première et de
 * la dernière année complète (janvier et décembre présents) de la série.
 * 0 si moins de deux années complètes.
 */
export function annualGrowth(points: MonthPoint[]): number {
  const months = new Set(points.map((p) => p.mois));
  const years = [...new Set(points.map((p) => Number(p.mois.slice(0, 4))))]
    .filter((y) => months.has(`${y}-01`) && months.has(`${y}-12`))
    .sort((a, b) => a - b);
  if (years.length < 2) return 0;
  const [first, last] = [years[0]!, years[years.length - 1]!];
  const janvier = (y: number) => points.find((p) => p.mois === `${y}-01`)!.value;
  if (janvier(first) <= 0) return 0;
  return (janvier(last) / janvier(first)) ** (1 / (last - first)) - 1;
}

/**
 * Montant mensuel moyen par année civile : moyenne des mois de l'année dans la série,
 * hors 1er mois de la série (souvent partiel) sauf s'il est le seul mois de son année
 * (ou si `exclurePremier` vaut false, cas d'une pension : 1er mois complet).
 */
export function yearlyAmounts(points: MonthPoint[], exclurePremier = true): Record<string, number> {
  const parAnnee: Record<string, number[]> = {};
  points.forEach((p, i) => {
    const annee = p.mois.slice(0, 4);
    const valeurs = (parAnnee[annee] ??= []);
    // 1er mois de la série : partiel, ignoré dès que l'année compte un autre mois.
    if (i === 0) valeurs.unshift(p.value);
    else valeurs.push(p.value);
  });
  const premiereAnnee = points[0]?.mois.slice(0, 4);
  const out: Record<string, number> = {};
  for (const [annee, valeurs] of Object.entries(parAnnee)) {
    const retenues =
      exclurePremier && annee === premiereAnnee && valeurs.length > 1 ? valeurs.slice(1) : valeurs;
    out[annee] = retenues.reduce((a, b) => a + b, 0) / retenues.length;
  }
  return out;
}

/**
 * Phase de revenu d'une série : montant = 2e mois (le 1er est souvent partiel),
 * ou le 1er si la série ne compte qu'un mois.
 */
export function seriesToPhase(
  id: string,
  personneId: string,
  series: PhaseSeries,
): ProjectionPhaseRevenu {
  const { points } = series;
  return {
    id,
    personneId,
    libelle: series.libelle,
    debut: points[0]!.mois,
    fin: points[points.length - 1]!.mois,
    netMensuel: { mode: 'manuel', manuel: (points[1] ?? points[0]!).value },
    revalorisationAnnuelle: annualGrowth(points),
    montantsAnnuels: yearlyAmounts(points),
  };
}

/** Écart de cash (€/mois) sous lequel deux séries sont considérées identiques. */
const ECART_NEGLIGEABLE = 0.5;

/**
 * Correction d'une série par rapport à une série de référence : le cash d'une personne
 * peut dépendre du scénario (taux de PAS) alors que sa phase importée est commune.
 * Phase « écart » sur toute la série (montants annuels = écart moyen), ou undefined si négligeable.
 */
export function differencePhase(
  id: string,
  personneId: string,
  libelle: string,
  points: MonthPoint[],
  reference: MonthPoint[],
): ProjectionPhaseRevenu | undefined {
  const ref = new Map(reference.map((p) => [p.mois, p.value]));
  const ecarts = points.flatMap((p) =>
    ref.has(p.mois) ? [{ mois: p.mois, value: p.value - ref.get(p.mois)! }] : [],
  );
  const montantsAnnuels = yearlyAmounts(ecarts, false);
  if (
    ecarts.length === 0 ||
    Object.values(montantsAnnuels).every((v) => Math.abs(v) < ECART_NEGLIGEABLE)
  )
    return undefined;
  return {
    id,
    personneId,
    libelle,
    debut: ecarts[0]!.mois,
    fin: ecarts[ecarts.length - 1]!.mois,
    netMensuel: { mode: 'manuel', manuel: 0 },
    revalorisationAnnuelle: 0,
    montantsAnnuels,
  };
}
