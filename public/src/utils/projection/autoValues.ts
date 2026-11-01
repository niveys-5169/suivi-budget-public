import type {
  Credit,
  ProjectionClasseCategorie,
  ProjectionMonth,
  ProjectionValeursObservees,
  Transaction,
} from '../../types/banking.types';
import { mensualite } from '../creditSchedule';
import { parseCalendarDate, toCalendarKey } from '../date';
import { expandVentilations } from '../ventilation';
import { defaultCategoryClass, type CategoryClassContext } from './categoryClasses';

export interface ObservedValuesInput {
  transactions: Transaction[];
  credits: Credit[];
  classes: Record<string, ProjectionClasseCategorie>;
  ctx: CategoryClassContext;
  patrimoineHorsPer: number | null;
}

const SANS_CATEGORIE = '(sans catégorie)';
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Opération comptabilisée : ni annulée, ni encore « en attente ». */
const isBooked = (tx: Transaction) =>
  tx.bankStatus !== 'cancelled' && tx.bankStatus !== 'pending' && !tx.enAttente;

/** Clé `YYYY-MM-DD` d'une transaction, ou null si la date est invalide. */
function dayKey(tx: Transaction): string | null {
  const date = parseCalendarDate(String(tx.date ?? '').slice(0, 10));
  return Number.isNaN(date.getTime()) ? null : toCalendarKey(date);
}

/** Début de la fenêtre : (fin + 1 jour) − 12 mois, en composantes numériques. */
function windowStart(fin: string): string {
  const d = parseCalendarDate(fin);
  const lendemain = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return toCalendarKey(
    new Date(lendemain.getFullYear() - 1, lendemain.getMonth(), lendemain.getDate()),
  );
}

/** Mois de la dernière échéance : dateDebut + dureeMois − 1 mois, ou null. */
function lastPaymentMonth(credit: Credit): ProjectionMonth | null {
  const start = parseCalendarDate(credit.dateDebut);
  if (Number.isNaN(start.getTime()) || credit.dureeMois <= 0) return null;
  const index = start.getFullYear() * 12 + start.getMonth() + credit.dureeMois - 1;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function observeCredits(credits: Credit[]): ProjectionValeursObservees['credits'] {
  const result: ProjectionValeursObservees['credits'] = {};
  for (const credit of credits) {
    const fin = lastPaymentMonth(credit);
    if (!fin) continue;
    // Mensualité hors assurance : l'assurance reste dans les dépenses courantes.
    result[credit.id] = {
      libelle: credit.nom,
      mensualite: mensualite(credit),
      fin,
      tauxAnnuel: credit.tauxAnnuel,
    };
  }
  return result;
}

/** Valeurs observées sur 12 mois glissants (règle de l'onglet ⑨ de l'Excel). */
export function computeObservedValues(input: ObservedValuesInput): ProjectionValeursObservees {
  const { transactions, credits, classes, ctx, patrimoineHorsPer } = input;
  const dated = expandVentilations(transactions.filter(isBooked))
    .map((tx) => ({ tx, key: dayKey(tx) }))
    .filter((e): e is { tx: Transaction; key: string } => e.key !== null);
  const observedCredits = observeCredits(credits);
  if (dated.length === 0) {
    return {
      periode: null,
      budgetReference: null,
      detailCategories: [],
      moyenneMensuelleParCategorie: {},
      credits: observedCredits,
      patrimoineHorsPer,
      epargneNetteMensuelle: null,
    };
  }

  const fin = dated.reduce((max, e) => (e.key > max ? e.key : max), dated[0]!.key);
  const debut = windowStart(fin);
  const soldes = new Map<string, number>();
  for (const { tx, key } of dated) {
    if (key < debut) continue;
    const cat = tx.categorie?.trim() || SANS_CATEGORIE;
    soldes.set(cat, (soldes.get(cat) ?? 0) + tx.montant);
  }

  const detailCategories = [...soldes.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([categorie, solde]) => {
      const classe = classes[categorie] ?? defaultCategoryClass(categorie, ctx);
      const soldeNet = round2(solde);
      const retenu = classe === 'depense' || classe === 'fixe' || classe === 'exclu';
      return { categorie, classe, soldeNet, retenuAnnuel: retenu ? -soldeNet : 0 };
    });

  const somme = (
    keep: (c: ProjectionClasseCategorie) => boolean,
    pick: 'retenuAnnuel' | 'soldeNet',
  ) => detailCategories.filter((d) => keep(d.classe)).reduce((s, d) => s + d[pick], 0);
  const budgetAnnuel = somme((c) => c !== 'exclu', 'retenuAnnuel');
  const epargneAnnuelle = -somme((c) => c === 'tresorerie', 'soldeNet');

  return {
    periode: { debut, fin },
    budgetReference: round2(budgetAnnuel / 12),
    detailCategories,
    moyenneMensuelleParCategorie: Object.fromEntries(
      detailCategories.map((d) => [d.categorie, round2(d.soldeNet / 12)]),
    ),
    credits: observedCredits,
    patrimoineHorsPer,
    epargneNetteMensuelle: round2(epargneAnnuelle / 12),
  };
}
