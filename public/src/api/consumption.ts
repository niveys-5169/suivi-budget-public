import { getAssignedMonthKey } from '../utils/date';

/**
 * consumption.ts — Calcul de la consommation des budgets (V1 côté client)
 *
 * Ce module réplique la logique du backend Python pour permettre un affichage réactif.
 */

export type PeriodType =
  'mois_courant' | 'annee_civile' | 'annee_glissante' | 'custom' | (string & {});

export interface BudgetPeriode {
  type: PeriodType;
  debut?: string;
  fin?: string;
}

export interface ConsumptionBudget {
  id?: string;
  nom?: string;
  categorie?: string;
  montant: number;
  type?: string;
  isIncome?: boolean;
  compte?: string | null;
  moisAttendus?: number[];
  periode?: BudgetPeriode;
}

export interface ConsumptionTransaction {
  id?: string;
  categorie?: string;
  montant?: number;
  date?: string;
  compte?: string;
  moisAffectation?: string;
}

export interface PeriodBounds {
  debut: string;
  fin: string;
}

export interface ConsumptionResult {
  budgetId?: string;
  nom?: string;
  categorie?: string;
  isIncome: boolean;
  montant: number;
  depense: number;
  reste: number;
  pourcentage: number;
  rythmeTheorique: number;
  ecartRythme: number;
  statut: 'ok' | 'attention' | 'depasse';
  periodeDebut: string;
  periodeFin: string;
  transactionIds: Array<string | undefined>;
}

// Helper pour formater une date en YYYY-MM-DD local sans décalage UTC
const toLocalISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function getPeriodBounds(
  budget: ConsumptionBudget,
  referenceDate: Date | string | number = new Date(),
): PeriodBounds {
  const ref = new Date(referenceDate);
  if (!budget?.periode?.type) {
    // Par défaut, mois courant si infos manquantes pour éviter le crash
    return {
      debut: toLocalISO(new Date(ref.getFullYear(), ref.getMonth(), 1)),
      fin: toLocalISO(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)),
    };
  }

  const pType = budget.periode.type;
  let debut: Date;
  let fin: Date;

  if (pType === 'mois_courant') {
    debut = new Date(ref.getFullYear(), ref.getMonth(), 1);
    fin = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  } else if (pType === 'annee_civile') {
    debut = new Date(ref.getFullYear(), 0, 1);
    fin = new Date(ref.getFullYear(), 11, 31);
  } else if (pType === 'annee_glissante') {
    fin = new Date(ref);
    debut = new Date(ref);
    debut.setFullYear(ref.getFullYear() - 1);
  } else if (pType === 'custom') {
    debut = new Date(budget.periode.debut || ref);
    fin = new Date(budget.periode.fin || ref);
  } else {
    // Fallback mois courant au lieu de throw
    debut = new Date(ref.getFullYear(), ref.getMonth(), 1);
    fin = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  }

  return {
    debut: toLocalISO(debut),
    fin: toLocalISO(fin),
  };
}

export function calculateRythmeTheorique(
  budget: ConsumptionBudget,
  referenceDate: Date | string | number,
  debutStr: string,
  finStr: string,
): number {
  const ref = new Date(referenceDate);
  const debut = new Date(debutStr);
  const fin = new Date(finStr);
  const montant = budget.montant;

  const joursTotaux = Math.round((+fin - +debut) / (1000 * 60 * 60 * 24)) + 1;
  const joursEcoules = Math.min(
    Math.max(0, Math.round((+ref - +debut) / (1000 * 60 * 60 * 24)) + 1),
    joursTotaux,
  );

  const moisAttendus = budget.moisAttendus || [];
  if (budget.type === 'annuel' && moisAttendus.length > 0) {
    if (budget.periode?.type === 'annee_civile') {
      const currentMonth = ref.getMonth() + 1; // 1-12
      const moisPasses = moisAttendus.filter((m) => m < currentMonth).length;
      const moisActuelEstAttendu = moisAttendus.includes(currentMonth);

      let proportionMoisActuel = 0;
      if (moisActuelEstAttendu) {
        const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
        proportionMoisActuel = ref.getDate() / lastDay;
      }

      const nbMoisEcoules = moisPasses + proportionMoisActuel;
      return montant * (nbMoisEcoules / moisAttendus.length);
    }
  }

  return montant * (joursEcoules / joursTotaux);
}

export function computeConsumption(
  budget: ConsumptionBudget,
  transactions: ConsumptionTransaction[],
  referenceDate: Date | string | number = new Date(),
): ConsumptionResult {
  const ref = new Date(referenceDate);
  const { debut, fin } = getPeriodBounds(budget, ref);
  const pType = budget.periode?.type;

  // Clés de comparaison pour les périodes standard
  const refMonthKey = debut.slice(0, 7); // YYYY-MM
  const refYear = debut.slice(0, 4); // YYYY

  // Filtrer les transactions
  const filteredTxs = transactions.filter((t) => {
    const isInCategory = t.categorie === budget.categorie;
    const isNotVirement = t.categorie !== 'Virement interne';
    const matchesAccount = !budget.compte || t.compte === budget.compte;

    if (!isInCategory || !isNotVirement || !matchesAccount) return false;

    // Matching de période
    if (pType === 'mois_courant') {
      return getAssignedMonthKey(t) === refMonthKey;
    } else if (pType === 'annee_civile') {
      return getAssignedMonthKey(t).startsWith(refYear);
    } else if (pType === 'annee_glissante' || pType === 'custom') {
      // Pour les périodes glissantes ou custom, on reste sur la date bancaire
      return (t.date ?? '') >= debut && (t.date ?? '') <= fin;
    }
    return false;
  });

  // Formule "-dépenses + revenus" : on additionne les montants signés (dépenses < 0, revenus > 0).
  // Les remboursements/avoirs réduisent donc bien la consommation nette d'une catégorie de dépense.
  const netAmount = filteredTxs.reduce((sum, t) => sum + (Number(t.montant) || 0), 0);

  // Déterminer si c'est un revenu.
  // Seuil strict : au moins 5 transactions ET 75%+ positives pour éviter de classer
  // les budgets mixtes (ex: Kdo anniversaires avec quelques remboursements) comme revenus.
  const isHistoricallyIncome = (): boolean => {
    if (!transactions || !transactions.length) return false;
    const catTxs = transactions.filter((t) => t.categorie === budget.categorie);
    const total = catTxs.length;
    if (total < 5) return false;
    const pos = catTxs.filter((t) => Number(t.montant) > 0).length;
    return pos / total >= 0.75;
  };

  // Manuel tri-état : true/false force le sens ; absent → heuristiques en secours.
  const isIncome =
    budget.isIncome === true
      ? true
      : budget.isIncome === false
        ? false
        : Boolean(budget.type === 'revenu' || isHistoricallyIncome());

  // Entrée : clamp à 0 (les remboursements ne créent pas de revenu supplémentaire).
  // Sortie : pas de clamp — le net peut passer positif quand remboursements > dépenses.
  const depense = isIncome ? Math.max(0, netAmount) : -netAmount;
  const montant = budget.montant;
  const reste = montant - depense;
  const pourcentage = montant > 0 ? (depense / montant) * 100 : 0;

  const rythmeTheorique = calculateRythmeTheorique(budget, ref, debut, fin);
  const ecartRythme = depense - rythmeTheorique;

  let statut: 'ok' | 'attention' | 'depasse' = 'ok';
  if (isIncome) {
    // Pour les revenus, être au-dessus du rythme est "ok" ou "excellent"
    // On considère "attention" si on est significativement en dessous du rythme
    if (depense < rythmeTheorique * 0.85) {
      statut = 'attention';
    } else if (depense < rythmeTheorique * 0.5) {
      statut = 'depasse'; // Ici "depasse" au sens négatif : gros manque à gagner
    }
  } else {
    // Pour les dépenses
    if (depense > montant) {
      statut = 'depasse';
    } else if (depense > rythmeTheorique * 1.15) {
      statut = 'attention';
    }
  }

  return {
    budgetId: budget.id,
    nom: budget.nom,
    categorie: budget.categorie,
    isIncome,
    montant,
    depense: Math.round(depense * 100) / 100,
    reste: Math.round(reste * 100) / 100,
    pourcentage: Math.round(pourcentage * 100) / 100,
    rythmeTheorique: Math.round(rythmeTheorique * 100) / 100,
    ecartRythme: Math.round(ecartRythme * 100) / 100,
    statut,
    periodeDebut: debut,
    periodeFin: fin,
    transactionIds: filteredTxs.map((t) => t.id),
  };
}
