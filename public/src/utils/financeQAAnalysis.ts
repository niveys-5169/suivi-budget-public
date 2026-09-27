import type { Transaction, BudgetBase } from '../types/banking.types';
import type { WealthSummary } from './wealthQAAnalysis';
import type { BudgetSummary } from './budgetQAAnalysis';
import { formatCurrency } from '../lib/formatters';
import {
  PATRIMONIAL_FLOW_CATEGORY_ALIASES,
  normalizeFlowCategory,
} from '../constants/transactionFlowCategories';

const FRENCH_STOP_WORDS = new Set([
  'a',
  'ai',
  'au',
  'aux',
  'avec',
  'ce',
  'ces',
  'dans',
  'de',
  'des',
  'du',
  'elle',
  'en',
  'et',
  'eux',
  'il',
  'je',
  'la',
  'le',
  'les',
  'leur',
  'lui',
  'ma',
  'mais',
  'me',
  'mes',
  'moi',
  'mon',
  'ne',
  'nos',
  'notre',
  'nous',
  'on',
  'ou',
  'par',
  'pas',
  'pour',
  'qu',
  'que',
  'qui',
  'sa',
  'se',
  'ses',
  'son',
  'sur',
  'ta',
  'te',
  'tes',
  'toi',
  'ton',
  'tu',
  'un',
  'une',
  'vos',
  'votre',
  'vous',
  'y',
]);

export function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSignificantTokens(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((t) => t.length >= 3 && !FRENCH_STOP_WORDS.has(t));
}

function buildTextualInsights(txs: Transaction[]) {
  const byMerchant: Record<
    string,
    { depenses: number; nb_transactions: number; mois: Set<string> }
  > = {};

  for (const tx of txs) {
    const tokens = extractSignificantTokens(`${tx.libelle || ''} ${tx.commentaire || ''}`);
    const uniques = [...new Set(tokens)];
    for (const token of uniques) {
      if (!byMerchant[token])
        byMerchant[token] = { depenses: 0, nb_transactions: 0, mois: new Set() };
      const montant = tx.montant ?? 0;
      if (montant < 0) byMerchant[token].depenses += montant;
      byMerchant[token].nb_transactions += 1;
      if (tx.date) byMerchant[token].mois.add(tx.date.slice(0, 7));
    }
  }

  return Object.entries(byMerchant)
    .map(([mot_cle, data]) => ({
      mot_cle,
      depenses: Math.round(data.depenses * 100) / 100,
      nb_transactions: data.nb_transactions,
      nb_mois: data.mois.size,
    }))
    .sort((a, b) => Math.abs(b.depenses) - Math.abs(a.depenses))
    .slice(0, 120);
}

export interface FinancialSummary {
  resume: {
    total_transactions: number;
    periode: string;
    comptes: string[];
  };
  totaux_par_categorie: Record<string, { depenses: number; recettes: number; nb: number }>;
  par_mois: Record<string, { depenses: number; recettes: number }>;
  par_annee: Record<string, { depenses: number; recettes: number }>;
  revenus_par_categorie_par_mois: Record<string, Record<string, number>>;
  budgets_par_categorie: Record<string, { montant: number; type: string; actif: boolean }>;
  analyse_textuelle: {
    mot_cle: string;
    depenses: number;
    nb_transactions: number;
    nb_mois: number;
  }[];
  transactions_detaillees: {
    date: string;
    libelle: string;
    commentaire: string;
    categorie: string;
    montant: number;
  }[];
  /** Absent si aucune transaction datée. */
  projection_fin_annee?: YearEndProjection;
}

export interface YearEndProjection {
  annee: string;
  /** Mois de l'année entièrement écoulés (le mois en cours est exclu). */
  mois_ecoules: number;
  /** Mois restants jusqu'au 31/12, mois en cours inclus. */
  mois_restants: number;
  /** Cumul des mois écoulés de l'année (dépenses négatives). */
  cumul_mois_ecoules: { recettes: number; depenses: number; solde_net: number };
  /** Moyenne des mois ayant des opérations sur les 12 derniers mois complets. */
  moyenne_mensuelle: { recettes: number; depenses: number; solde_net: number; nb_mois: number };
  /** cumul_mois_ecoules.solde_net + moyenne_mensuelle.solde_net × mois_restants. */
  solde_net_annuel_projete: number;
}

const PATRIMONIAL_FLOWS = new Set<string>(
  PATRIMONIAL_FLOW_CATEGORY_ALIASES.map(normalizeFlowCategory),
);

/**
 * Projection déterministe de fin d'année (hors virements internes et flux
 * d'épargne) : permet au LLM de répondre à « puis-je me permettre X € ? »
 * sans avoir à refaire les calculs lui-même.
 */
export function buildYearEndProjection(
  txs: Transaction[],
  today = new Date(),
): YearEndProjection | undefined {
  const round = (n: number) => Math.round(n * 100) / 100;
  const year = today.getFullYear();
  const currentMonth = `${year}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const byMonth: Record<string, { recettes: number; depenses: number }> = {};

  for (const tx of txs) {
    const month = (tx.date || '').slice(0, 7);
    if (!month || month >= currentMonth) continue;
    if (PATRIMONIAL_FLOWS.has(normalizeFlowCategory(tx.categorie))) continue;
    const montant = tx.montant ?? 0;
    const m = (byMonth[month] ??= { recettes: 0, depenses: 0 });
    if (montant < 0) m.depenses += montant;
    else m.recettes += montant;
  }

  const months = Object.keys(byMonth).sort();
  if (!months.length) return undefined;

  const windowStart = `${year - 1}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const recent = months.filter((m) => m >= windowStart);
  const last12 = recent.length ? recent : months.slice(-12);
  const sum = (keys: string[], field: 'recettes' | 'depenses') =>
    keys.reduce((acc, k) => acc + byMonth[k]![field], 0);
  const avgRecettes = sum(last12, 'recettes') / last12.length;
  const avgDepenses = sum(last12, 'depenses') / last12.length;

  const ytd = months.filter((m) => m.startsWith(`${year}-`));
  const cumulRecettes = sum(ytd, 'recettes');
  const cumulDepenses = sum(ytd, 'depenses');
  const moisEcoules = today.getMonth();
  const moisRestants = 12 - moisEcoules;
  const avgNet = avgRecettes + avgDepenses;

  return {
    annee: String(year),
    mois_ecoules: moisEcoules,
    mois_restants: moisRestants,
    cumul_mois_ecoules: {
      recettes: round(cumulRecettes),
      depenses: round(cumulDepenses),
      solde_net: round(cumulRecettes + cumulDepenses),
    },
    moyenne_mensuelle: {
      recettes: round(avgRecettes),
      depenses: round(avgDepenses),
      solde_net: round(avgNet),
      nb_mois: last12.length,
    },
    solde_net_annuel_projete: round(cumulRecettes + cumulDepenses + avgNet * moisRestants),
  };
}

/**
 * La recherche web n'est utile que pour des informations externes (taux,
 * marchés, fiscalité, actualité…). Sur une question portant sur la situation
 * de l'utilisateur, elle fait dériver le modèle (ex. « budget » → budget de
 * l'État) : on ne l'active donc que sur ces sujets.
 */
export function questionNeedsWebSearch(question: string): boolean {
  return /\b(taux|livret|lep|pel|inflation|bourse|actions?|etf|marches?|indices?|cac|actualites?|news|loi|impots?|fiscal\w*|tmi|bareme|smic|internet|web|en ligne|recherche)\b/.test(
    normalizeText(question),
  );
}

/** Nombre maximal de transactions détaillées envoyées au LLM. */
const MAX_DETAILED_TRANSACTIONS = 500;

/**
 * Sélectionne les transactions détaillées : d'abord celles dont le libellé ou
 * le commentaire contient un mot-clé de la question (sur tout l'historique),
 * puis les plus récentes pour compléter.
 */
function selectDetailedTransactions(txs: Transaction[], question: string): Transaction[] {
  const byDateDesc = [...txs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const tokens = extractSignificantTokens(question);
  const relevant = tokens.length
    ? byDateDesc.filter((tx) => {
        const searchable = normalizeText(`${tx.libelle || ''} ${tx.commentaire || ''}`);
        return tokens.some((token) => searchable.includes(token));
      })
    : [];
  const selected = new Set(relevant.slice(0, MAX_DETAILED_TRANSACTIONS));
  for (const tx of byDateDesc) {
    if (selected.size >= MAX_DETAILED_TRANSACTIONS) break;
    selected.add(tx);
  }
  return [...selected];
}

export function buildFinancialSummary(
  txs: Transaction[],
  budgets: BudgetBase[] = [],
  question = '',
): FinancialSummary | null {
  if (!txs.length) return null;

  const byCategory: Record<string, { depenses: number; recettes: number; nb: number }> = {};
  const byMonth: Record<string, { depenses: number; recettes: number }> = {};
  const byYear: Record<string, { depenses: number; recettes: number }> = {};
  const byCatByMonth: Record<string, Record<string, number>> = {};

  for (const tx of txs) {
    const montant = tx.montant ?? 0;
    const cat = tx.categorie || 'Sans catégorie';
    const date = tx.date || '';
    const month = date.slice(0, 7);
    const year = date.slice(0, 4);

    if (!byCategory[cat]) byCategory[cat] = { depenses: 0, recettes: 0, nb: 0 };
    if (montant < 0) byCategory[cat].depenses += montant;
    else byCategory[cat].recettes += montant;
    byCategory[cat].nb++;

    if (month) {
      if (!byMonth[month]) byMonth[month] = { depenses: 0, recettes: 0 };
      if (montant < 0) byMonth[month].depenses += montant;
      else byMonth[month].recettes += montant;

      if (montant > 0) {
        if (!byCatByMonth[cat]) byCatByMonth[cat] = {};
        byCatByMonth[cat][month] = (byCatByMonth[cat][month] || 0) + montant;
      }
    }

    if (year) {
      if (!byYear[year]) byYear[year] = { depenses: 0, recettes: 0 };
      if (montant < 0) byYear[year].depenses += montant;
      else byYear[year].recettes += montant;
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat]!.depenses = round(byCategory[cat]!.depenses);
    byCategory[cat]!.recettes = round(byCategory[cat]!.recettes);
  }
  for (const m of Object.keys(byMonth)) {
    byMonth[m]!.depenses = round(byMonth[m]!.depenses);
    byMonth[m]!.recettes = round(byMonth[m]!.recettes);
  }
  for (const y of Object.keys(byYear)) {
    byYear[y]!.depenses = round(byYear[y]!.depenses);
    byYear[y]!.recettes = round(byYear[y]!.recettes);
  }

  const dates = txs
    .map((t) => t.date)
    .filter(Boolean)
    .sort();

  return {
    resume: {
      total_transactions: txs.length,
      periode: dates.length ? `${dates[0]} à ${dates[dates.length - 1]}` : 'inconnue',
      comptes: [...new Set(txs.map((t) => t.compte).filter(Boolean) as string[])],
    },
    totaux_par_categorie: byCategory,
    par_mois: byMonth,
    par_annee: byYear,
    revenus_par_categorie_par_mois: byCatByMonth,
    budgets_par_categorie: Object.fromEntries(
      budgets
        .filter((b) => b.actif)
        .map((b) => [b.categorie, { montant: b.montant, type: b.type, actif: b.actif }]),
    ),
    analyse_textuelle: buildTextualInsights(txs),
    transactions_detaillees: selectDetailedTransactions(txs, question).map((tx) => ({
      date: tx.date || '',
      libelle: tx.libelle || '',
      commentaire: tx.commentaire || '',
      categorie: tx.categorie || '',
      montant: Math.round((tx.montant ?? 0) * 100) / 100,
    })),
    projection_fin_annee: buildYearEndProjection(txs),
  };
}

export function buildSystemPrompt(
  summary: FinancialSummary,
  wealth?: WealthSummary | null,
  budget?: BudgetSummary | null,
): string {
  const wealthSection = wealth
    ? `

Structure des données patrimoniales ("patrimoine") :
- "date_reference" / "date_comparaison" : dates (aujourd'hui vs ~30 jours avant)
- "par_owner" : pour chaque propriétaire, sa répartition "actuel" et "il_y_a_30j" sur 4 segments (courants, epargne, investissements, retraite) + "total", et "evolution" { montant, pct } du total
- "global" : mêmes données cumulées tous propriétaires confondus
- Les actifs de RETRAITE (PER) sont isolés dans le segment "retraite", distinct des autres placements
- "il_y_a_30j" et "evolution" valent null quand l'historique ne couvre pas la période : dans ce cas, indique-le au lieu d'inventer une évolution

Règles patrimoine :
- Pour l'évolution de l'épargne/du patrimoine, utilise "evolution.montant" et "evolution.pct" (ou recalcule actuel.total - il_y_a_30j.total)
- Quand on parle d'épargne "au sens large", inclus epargne + investissements + retraite (tout sauf les comptes courants), mais sépare la retraite si demandé

Données patrimoniales :
${JSON.stringify(wealth, null, 2)}`
    : '';

  const budgetSection = budget
    ? `

Structure des données budgétaires ("budgets"), mêmes calculs que les écrans Budgets / Enveloppes / Prévisionnel :
- "budgets_du_mois" : chaque budget mensuel de dépense du mois en cours — budget, dépensé (net des remboursements), reste, % consommé, projection fin de mois au rythme actuel, statut (ok / a_surveiller / depasse), et cumul sur l'année (budget × 12)
- "total_budgets_mois" : somme des budgets mensuels (hors enveloppes)
- "enveloppes" : budgets annuels provisionnés (vacances, taxe foncière…) suivis sur un cycle de 12 mois se terminant au mois "echeance" : montant, dépensé sur le cycle, reste à dépenser, provision mensuelle
- "engagements_a_venir" : échéances récurrentes attendues (abonnements, loyer, crédits, salaires…) jusqu'à "jusqu_au" — montants signés (négatif = sortie), totaux
- "tresorerie" : solde actuel des comptes courants, solde projeté à "engagements_a_venir.jusqu_au" en appliquant uniquement ces échéances récurrentes (hors dépenses variables comme les courses), point bas et première date de passage sous zéro

Données budgétaires :
${JSON.stringify(budget, null, 2)}`
    : '';

  const today = new Date().toLocaleDateString('fr-CA'); // YYYY-MM-DD, heure locale

  return `Tu es un assistant financier personnel. Tu analyses les données financières de l'utilisateur et tu réponds à ses questions.

Date du jour : ${today}. Utilise-la pour interpréter "ce mois-ci", "l'an dernier", etc.

Sources :
- Les chiffres personnels de l'utilisateur (dépenses, revenus, soldes, patrimoine) proviennent UNIQUEMENT des données ci-dessous : n'en invente jamais
- Les agrégats ("totaux_par_categorie", "par_mois", "par_annee"…) couvrent TOUT l'historique des transactions
- Si des outils de calcul sont disponibles (totaux, etat_budgets, simuler_depense), utilise-les pour TOUT chiffre précis (total sur une période, une catégorie ou un marchand, comparaison de périodes, état des budgets d'un mois, impact d'un achat) plutôt que de calculer toi-même à partir du JSON ; appelle-les autant de fois que nécessaire (ex. une fois par période à comparer). N'annonce pas que tu vas les appeler : appelle-les, puis réponds
- Pour les informations externes (taux du Livret A, inflation, cours de bourse, actualité, fiscalité…), utilise la recherche web si elle est disponible et cite brièvement la source ; sinon, précise que l'information peut être datée

Structure des données :
- "totaux_par_categorie" : dépenses et recettes totales par catégorie (montants négatifs = dépenses)
- "par_mois" : totaux mensuels toutes catégories confondues (clé YYYY-MM)
- "par_annee" : totaux annuels (clé YYYY)
- "revenus_par_categorie_par_mois" : recettes ventilées par catégorie puis par mois
- "budgets_par_categorie" : définition brute des budgets (pour leur consommation, utilise la section "budgets" ci-dessous)
- "analyse_textuelle" : signaux calculés depuis libellés + commentaires
- "transactions_detaillees" : extrait de transactions — celles dont le libellé correspond aux mots de la question (tout l'historique), puis les plus récentes (ne pas utiliser pour les totaux)
- "projection_fin_annee" : cumul des mois écoulés de l'année, moyenne mensuelle (12 derniers mois complets) et solde net annuel projeté, hors virements internes et flux d'épargne (déjà calculés : réutilise ces chiffres)

Interprétation des questions :
- "budget", "mes finances", "fin d'année", "problème", "dette"… concernent TOUJOURS la situation personnelle de l'utilisateur, jamais le budget de l'État, l'économie ou l'actualité
- Tu as accès à toutes ses données : ne lui demande JAMAIS ses revenus, dépenses, budgets ou objectifs, et ne réponds jamais de façon générique ("il faudrait analyser…", "si votre budget est serré…")
- Quand l'utilisateur donne un prix, utilise-le tel quel : ne cherche pas de prix de marché
- Question du type "puis-je me permettre / est-ce que cet achat de X € pose problème ?" : appelle l'outil simuler_depense s'il est disponible (avec la catégorie si elle est identifiable) et appuie ton verdict sur son résultat ; à défaut, vérifie (1) la marge annuelle "projection_fin_annee.solde_net_annuel_projete" − X, (2) la trésorerie "budgets.tresorerie.point_bas.solde" − X (reste-t-il positif ?), (3) le reste du budget ou de l'enveloppe de la catégorie concernée et les enveloppes pas encore consommées d'ici l'échéance ; puis donne un verdict clair (oui / oui mais / non) avec 2-3 chiffres clés
- Demande de solution pour lisser, étaler ou financer un achat (ou verdict oui_mais / non) : propose 2 à 4 options concrètes, CHACUNE chiffrée par un appel à simuler_depense : (a) paiement en 3x ou 4x sans frais (souvent proposé par le marchand ou via PayPal, Alma, Oney, Klarna) → nb_mensualites ; (b) pour un montant plus élevé, paiement en 10x, en précisant que les frais éventuels en font un crédit à comparer (TAEG) → nb_mensualites + frais si connus ; (c) décaler l'achat après la prochaine rentrée d'argent (voir budgets.engagements_a_venir) → date ; (d) si c'est la trésorerie qui coince, puiser dans l'épargne disponible (patrimoine → epargne). Pour chaque option : mensualité, budget respecté ou non, point bas de trésorerie. Termine par l'option que tu recommandes et pourquoi
- Ne donne jamais de conseil vague sans chiffre ("réduire d'autres dépenses", "augmenter vos revenus", "reporter à une période plus favorable") : nomme la catégorie, le montant ou la date

Règles STRICTES (à respecter en priorité absolue) :
- Réponds TOUJOURS et ENTIÈREMENT en français (titres, listes, chiffres commentés inclus) — jamais un seul mot d'anglais, même si la question est en anglais
- Réponse COURTE : maximum 10 lignes. Va droit au but, sans introduction ("Bien sûr !", "Voici…") ni conclusion ("En résumé…", "N'hésite pas…")
- Termine TOUJOURS ta réponse par une phrase complète avec un point final : ne t'arrête jamais au milieu d'une phrase, d'un mot ou d'une liste
- Sois précis, concis et structuré (listes à puces courtes si besoin)
- Exprime les montants en euros (€), les dépenses en valeur absolue
- Si la donnée demandée n'est pas disponible, précise-le clairement en une phrase
- Pour les comparaisons temporelles, calcule les variations en % si utile
- Pour calculer le "reste à dépenser" d'un budget : montant_budget - |depenses_categorie|. Valeur positive = marge restante. Valeur négative = dépassement.

Données financières :
${JSON.stringify(summary, null, 2)}${budgetSection}${wealthSection}`;
}

export function tryDirectSpendingAnswer(userQuestion: string, txs: Transaction[]): string | null {
  const question = normalizeText(userQuestion);
  if (!txs.length) return null;

  const targetMatch =
    userQuestion.match(/(?:pour|concernant|sur)\s+(.+?)(?:\?|$)/i) ||
    userQuestion.match(/(?:depense|dépense|paye|payé|payer)\s+(.+?)(?:\?|$)/i);
  if (!targetMatch?.[1]) return null;

  const targetRaw = targetMatch[1];
  const tokens = extractSignificantTokens(targetRaw);
  if (!tokens.length) return null;

  const asksSpending = /(combien|total|depens|dépens|paye|payé|payer|cout|coût)/.test(question);
  if (!asksSpending) return null;

  const matches = txs.filter((tx) => {
    const searchable = normalizeText(`${tx.libelle || ''} ${tx.commentaire || ''}`);
    return tokens.every((token) => searchable.includes(token));
  });

  const expenseMatches = matches.filter((tx) => (Number(tx.montant) || 0) < 0);
  if (!expenseMatches.length) return null;

  const total = expenseMatches.reduce((sum, tx) => sum + Math.abs(tx.montant ?? 0), 0);
  const months = new Set(expenseMatches.map((tx) => (tx.date || '').slice(0, 7)));
  const sortedDates = expenseMatches
    .map((tx) => tx.date)
    .filter(Boolean)
    .sort();
  const first = sortedDates[0];
  const last = sortedDates[sortedDates.length - 1];

  return [
    `J'ai trouvé **${expenseMatches.length} transaction(s)** liées à "${targetRaw.trim()}".`,
    `- **Total payé** : **${formatCurrency(total)}**`,
    `- **Nombre de mois concernés** : **${months.size}**`,
    first && last ? `- **Période** : du **${first}** au **${last}**` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
