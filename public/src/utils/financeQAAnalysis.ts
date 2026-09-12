import type { Transaction, BudgetBase } from '../types/banking.types';
import type { WealthSummary } from './wealthQAAnalysis';
import { formatCurrency } from '../lib/formatters';

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
}

export function buildFinancialSummary(
  txs: Transaction[],
  budgets: BudgetBase[] = [],
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
    transactions_detaillees: txs.slice(0, 500).map((tx) => ({
      date: tx.date || '',
      libelle: tx.libelle || '',
      commentaire: tx.commentaire || '',
      categorie: tx.categorie || '',
      montant: Math.round((tx.montant ?? 0) * 100) / 100,
    })),
  };
}

export function buildSystemPrompt(
  summary: FinancialSummary,
  wealth?: WealthSummary | null,
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

  return `Tu es un assistant financier personnel. Tu analyses les données financières de l'utilisateur et tu réponds à ses questions en te basant UNIQUEMENT sur les données fournies.

Structure des données :
- "totaux_par_categorie" : dépenses et recettes totales par catégorie (montants négatifs = dépenses)
- "par_mois" : totaux mensuels toutes catégories confondues (clé YYYY-MM)
- "par_annee" : totaux annuels (clé YYYY)
- "revenus_par_categorie_par_mois" : recettes ventilées par catégorie puis par mois
- "budgets_par_categorie" : objectifs de dépense/recette par catégorie (montant = plafond mensuel défini par l'utilisateur)
- "analyse_textuelle" : signaux calculés depuis libellés + commentaires
- "transactions_detaillees" : extrait partiel de transactions (ne pas utiliser pour les totaux)

Règles :
- Réponds toujours en français
- Sois précis, concis et structuré
- Exprime les montants en euros (€), les dépenses en valeur absolue
- Si la donnée demandée n'est pas disponible, précise-le clairement
- Pour les comparaisons temporelles, calcule les variations en % si utile
- Pour calculer le "reste à dépenser" d'un budget : montant_budget - |depenses_categorie|. Valeur positive = marge restante. Valeur négative = dépassement.

Données financières :
${JSON.stringify(summary, null, 2)}${wealthSection}`;
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
