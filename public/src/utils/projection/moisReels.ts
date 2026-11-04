import type {
  ProjectionClasseCategorie,
  ProjectionInputs,
  ProjectionMoisReel,
  ProjectionMonth,
  ProjectionParams,
  ProjectionPersonne,
  Transaction,
} from '../../types/banking.types';
import { getAssignedMonthKey, parseDateInput } from '../date';
import { expandVentilations } from '../ventilation';
import { buildWealthTimeline, type RawHistoryEntry } from '../wealthTimeline';
import { defaultCategoryClass, type CategoryClassContext } from './categoryClasses';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Opération acquise : non annulée, et comptabilisée ou certifiée (pointée) malgré l'attente bancaire. */
const isBooked = (tx: Transaction) =>
  tx.bankStatus !== 'cancelled' && (!!tx.pointe || (tx.bankStatus !== 'pending' && !tx.enAttente));

const moisCle = (d: Date): ProjectionMonth =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Minuscules, sans accents. */
const normaliser = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/** Personne dont le prénom apparaît dans le nom de la catégorie (mot entier), sinon undefined. */
function personneParPrenom(cat: string, personnes: ProjectionPersonne[]): string | undefined {
  const mots = normaliser(cat).split(/[^a-z0-9]+/);
  return personnes.find((p) => p.prenom.trim() && mots.includes(normaliser(p.prenom)))?.id;
}

/** Catégorie source -> personne : phases communes puis phases de tous les scénarios. */
function categoriesParPersonne(params: ProjectionParams): Map<string, string> {
  const map = new Map<string, string>();
  const phases = [...params.revenusCommuns.phases, ...params.scenarios.flatMap((s) => s.phases)];
  for (const phase of phases)
    for (const cat of phase.categoriesSource ?? [])
      if (!map.has(cat)) map.set(cat, phase.personneId);
  return map;
}

export interface MoisRelevesInput {
  transactions: Transaction[];
  params: ProjectionParams;
  ctx: CategoryClassContext;
  /** Date du jour : seuls les mois révolus (antérieurs au mois courant) sont relevés. */
  aujourdhui: Date;
}

/**
 * Montants réalisés exacts de chaque mois révolu de l'horizon, à partir de toutes les
 * transactions (mois d'affectation), virements internes exceptés :
 * - revenus d'une personne = catégories sources de ses phases ; à défaut, catégories de revenus
 *   dont le nom contient son prénom (« Salaire Nicolas ») ;
 * - CAF = catégories sources de la CAF ;
 * - autres revenus = autres catégories « revenu », et entrées des catégories « ponctuel » ;
 * - dépenses = catégories « dépense », « fixe » et « exclu », et sorties des « ponctuel » ;
 * - épargne nette = catégories « trésorerie » (versements − retraits d'épargne). Elle n'entre
 *   ni dans les revenus ni dans les dépenses : l'argent épargné reste dans le patrimoine.
 * Les flux exceptionnels théoriques sont neutralisés (0) : tout est déjà dans les montants exacts.
 */
export function computeMoisReleves(
  input: MoisRelevesInput,
): Record<ProjectionMonth, ProjectionMoisReel> {
  const { transactions, params, ctx, aujourdhui } = input;
  const moisCourant = moisCle(aujourdhui);
  const parPersonne = categoriesParPersonne(params);
  const cafCategories = new Set(params.revenusCommuns.caf.categoriesSource ?? []);
  const classe = (cat: string): ProjectionClasseCategorie =>
    params.classesCategories[cat] ?? defaultCategoryClass(cat, ctx);

  type Flux = Required<Omit<ProjectionMoisReel, 'patrimoineFin'>>;
  const releves: Record<ProjectionMonth, Flux> = {};
  const vide = (): Flux => ({
    revenusParPersonne: Object.fromEntries(params.personnes.map((p) => [p.id, 0])),
    caf: 0,
    autresRevenus: 0,
    depenses: 0,
    fluxExceptionnels: 0,
    epargneNette: 0,
  });
  const sansSource = params.personnes.filter((p) => ![...parPersonne.values()].includes(p.id));

  for (const tx of expandVentilations(transactions.filter(isBooked))) {
    const mois = getAssignedMonthKey(tx);
    if (!/^\d{4}-\d{2}$/.test(mois)) continue;
    if (mois < params.horizon.debut || mois > params.horizon.fin || mois >= moisCourant) continue;
    const cat = tx.categorie?.trim() ?? '';
    const r = (releves[mois] ??= vide());
    const c = classe(cat || '(sans catégorie)');
    const personne =
      parPersonne.get(cat) ??
      (c === 'revenu' && !cafCategories.has(cat) ? personneParPrenom(cat, sansSource) : undefined);
    if (personne !== undefined) {
      r.revenusParPersonne[personne] = (r.revenusParPersonne[personne] ?? 0) + tx.montant;
    } else if (cafCategories.has(cat)) {
      r.caf += tx.montant;
    } else if (c === 'revenu' || (c === 'ponctuel' && tx.montant > 0)) {
      r.autresRevenus += tx.montant;
    } else if (c === 'tresorerie') {
      r.epargneNette -= tx.montant;
    } else if (c !== 'interne') {
      r.depenses -= tx.montant;
    }
  }

  for (const r of Object.values(releves)) {
    for (const id of Object.keys(r.revenusParPersonne))
      r.revenusParPersonne[id] = round2(r.revenusParPersonne[id] ?? 0);
    r.caf = round2(r.caf);
    r.autresRevenus = round2(r.autresRevenus);
    r.depenses = round2(r.depenses);
    r.epargneNette = round2(r.epargneNette);
  }
  return releves;
}

/**
 * Patrimoine réel hors PER et hors immobilier (comptes courants + épargne + investissements,
 * comme le patrimoine de départ) à la fin de chaque mois révolu de l'horizon : dernier point
 * de l'historique des comptes daté dans le mois. Un mois sans point n'est pas recalé.
 */
export function computePatrimoineReelParMois(
  history: RawHistoryEntry[],
  horizon: ProjectionParams['horizon'],
  aujourdhui: Date,
): Record<ProjectionMonth, number> {
  const moisCourant = moisCle(aujourdhui);
  const result: Record<ProjectionMonth, number> = {};
  // Timeline triée par date : le dernier point d'un mois écrase les précédents.
  for (const point of buildWealthTimeline(history)) {
    const date = parseDateInput(point.timestamp);
    if (!date) continue;
    const mois = moisCle(date);
    if (mois < horizon.debut || mois > horizon.fin || mois >= moisCourant) continue;
    const { courants, epargne, investissements } = point.byCat;
    result[mois] = round2(courants + epargne + investissements);
  }
  return result;
}

/** Ajoute le patrimoine réel de fin de mois aux montants relevés (un mois peut n'avoir que lui). */
export function ajouterPatrimoineReel(
  releves: Record<ProjectionMonth, ProjectionMoisReel>,
  patrimoineParMois: Record<ProjectionMonth, number>,
): Record<ProjectionMonth, ProjectionMoisReel> {
  const result = { ...releves };
  for (const [mois, patrimoineFin] of Object.entries(patrimoineParMois))
    result[mois] = { ...result[mois], patrimoineFin };
  return result;
}

/** Relevés complétés des saisies manuelles (une saisie prime, champ par champ). */
export function mergeMoisReels(
  releves: Record<ProjectionMonth, ProjectionMoisReel>,
  saisies: Record<ProjectionMonth, ProjectionMoisReel> | undefined,
): NonNullable<ProjectionInputs['moisReels']> {
  const result: NonNullable<ProjectionInputs['moisReels']> = {};
  for (const [mois, valeurs] of Object.entries(releves))
    result[mois] = { valeurs, source: 'releve' };
  for (const [mois, saisie] of Object.entries(saisies ?? {})) {
    const base = releves[mois] ?? {};
    result[mois] = {
      valeurs: {
        ...base,
        ...saisie,
        revenusParPersonne: { ...base.revenusParPersonne, ...saisie.revenusParPersonne },
      },
      source: 'manuel',
    };
  }
  return result;
}
