/**
 * @file computeHealthScore.ts
 * @description Calcule un score de santé financière 0-100 à partir de 4 sous-scores
 * pondérés : taux d'épargne (RAV), respect des budgets, diversification du patrimoine,
 * tendance des dépenses. Fonction pure, sans dépendance React/Firestore.
 */

export type HealthSubScoreKey = 'savings' | 'budget' | 'diversification' | 'trend';
export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface HealthSubScore {
  key: HealthSubScoreKey;
  label: string;
  score: number; // 0-100
  weight: number;
  detail: string;
}

export interface HealthRecommendation {
  key: HealthSubScoreKey;
  title: string;
  desc: string;
  severity: 'low' | 'medium' | 'high';
}

export interface HealthScore {
  score: number; // 0-100, arrondi
  grade: HealthGrade;
  subScores: HealthSubScore[];
  recommendations: HealthRecommendation[];
}

export interface HealthScoreInput {
  /** reste/revenuRef du calcul RAV (0..1), ou null si données insuffisantes. */
  savingsRate: number | null;
  /** Nombre de budgets dépassés ce mois (useAlerts errorCount). */
  budgetErrorCount: number;
  /** Nombre de budgets actifs au total. */
  budgetTotalCount: number;
  /** Répartition du patrimoine par type, issus de useWealthAggregates. */
  segments: { type: string; pct: number }[];
  /** Variation des dépenses totales mois courant vs mois précédent (en %). Null si insuffisant. */
  spendingDeltaPct: number | null;
}

function gradeFromScore(score: number): HealthGrade {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'E';
}

function savingsSubScore(savingsRate: number | null): HealthSubScore | null {
  if (savingsRate === null) return null;
  // 30 % du revenu = score parfait, 0 % = 0, linéaire entre les deux.
  const raw = Math.max(0, Math.min(1, savingsRate / 0.3));
  const score = Math.round(raw * 100);
  const pct = Math.round(savingsRate * 100);
  return {
    key: 'savings',
    label: "Taux d'épargne",
    score,
    weight: 0.35,
    detail: `${pct} % du revenu`,
  };
}

function budgetSubScore(errorCount: number, total: number): HealthSubScore {
  if (total === 0) {
    return {
      key: 'budget',
      label: 'Budgets',
      score: 70,
      weight: 0.25,
      detail: 'Aucun budget défini',
    };
  }
  const score = Math.round(Math.max(0, (1 - errorCount / total) * 100));
  return {
    key: 'budget',
    label: 'Budgets',
    score,
    weight: 0.25,
    detail:
      errorCount === 0
        ? 'Tous les budgets respectés'
        : `${errorCount} dépassement${errorCount > 1 ? 's' : ''} sur ${total}`,
  };
}

function diversificationSubScore(segments: { type: string; pct: number }[]): HealthSubScore {
  if (segments.length === 0 || segments.every((s) => s.pct === 0)) {
    return {
      key: 'diversification',
      label: 'Diversification',
      score: 50,
      weight: 0.2,
      detail: 'Données patrimoniales manquantes',
    };
  }
  // HHI (Herfindahl–Hirschman Index) : plus il est élevé, plus la concentration est forte.
  const hhi = segments.reduce((sum, s) => sum + Math.pow(s.pct / 100, 2), 0);
  // HHI min théorique (4 classes équipondérées) = 0.25, max = 1 (mono-classe).
  const normalized = Math.max(0, Math.min(1, (hhi - 0.25) / 0.75));
  const score = Math.round((1 - normalized) * 100);

  const dominant = segments.reduce((a, b) => (a.pct > b.pct ? a : b), segments[0]!);
  const typesAbove5 = segments.filter((s) => s.pct > 5).length;
  const detail =
    typesAbove5 >= 3
      ? `${typesAbove5} classes actives`
      : `${Math.round(dominant.pct)} % en ${dominant.type}`;

  return {
    key: 'diversification',
    label: 'Diversification',
    score,
    weight: 0.2,
    detail,
  };
}

function trendSubScore(spendingDeltaPct: number | null): HealthSubScore {
  if (spendingDeltaPct === null) {
    return {
      key: 'trend',
      label: 'Tendance dépenses',
      score: 70,
      weight: 0.2,
      detail: 'Données insuffisantes',
    };
  }
  // +20 % ou plus = score 0 ; stable ou en baisse = score 100 ; linéaire entre les deux.
  const raw = Math.max(0, Math.min(1, 1 - spendingDeltaPct / 20));
  const score = Math.round(raw * 100);
  const sign = spendingDeltaPct > 0 ? '+' : '';
  return {
    key: 'trend',
    label: 'Tendance dépenses',
    score,
    weight: 0.2,
    detail: `${sign}${Math.round(spendingDeltaPct)} % vs mois précédent`,
  };
}

const RECOMMENDATIONS: Record<
  HealthSubScoreKey,
  (sub: HealthSubScore, input: HealthScoreInput) => HealthRecommendation
> = {
  savings: (sub) => ({
    key: 'savings',
    title: 'Augmentez votre épargne',
    desc:
      sub.score < 30
        ? 'Votre reste à vivre est très faible. Visez 10 % de vos revenus épargnés.'
        : 'Vous épargnez en dessous des 30 % recommandés. Essayez de virer automatiquement la différence en début de mois.',
    severity: sub.score < 30 ? 'high' : 'medium',
  }),
  budget: (sub, input) => ({
    key: 'budget',
    title: 'Réduisez les dépassements',
    desc:
      input.budgetTotalCount === 0
        ? 'Définissez au moins un budget mensuel pour suivre vos dépenses.'
        : `${input.budgetErrorCount} enveloppe${input.budgetErrorCount > 1 ? 's ont été dépassées' : ' a été dépassée'} ce mois. Ajustez vos limites ou réduisez les achats correspondants.`,
    severity: input.budgetErrorCount >= 3 ? 'high' : 'medium',
  }),
  diversification: (sub) => ({
    key: 'diversification',
    title: 'Diversifiez votre patrimoine',
    desc:
      sub.score < 40
        ? "Votre patrimoine est très concentré. Envisagez de l'ouvrir à d'autres classes d'actifs."
        : 'Répartissez davantage entre liquidités, épargne et investissements pour réduire le risque.',
    severity: sub.score < 40 ? 'high' : 'low',
  }),
  trend: (sub) => ({
    key: 'trend',
    title: 'Maîtrisez la hausse des dépenses',
    desc:
      sub.score < 40
        ? "Vos dépenses ont fortement augmenté ce mois. Identifiez les catégories en cause dans l'onglet Analyses."
        : 'Vos dépenses sont en hausse. Consultez les tendances pour identifier la catégorie à surveiller.',
    severity: sub.score < 40 ? 'high' : 'medium',
  }),
};

export function computeHealthScore(input: HealthScoreInput): HealthScore {
  const rawSubScores: (HealthSubScore | null)[] = [
    savingsSubScore(input.savingsRate),
    budgetSubScore(input.budgetErrorCount, input.budgetTotalCount),
    diversificationSubScore(input.segments),
    trendSubScore(input.spendingDeltaPct),
  ];

  // Filtre les sous-scores nulls et renormalise les poids.
  const available = rawSubScores.filter((s): s is HealthSubScore => s !== null);
  const totalWeight = available.reduce((s, sub) => s + sub.weight, 0);
  const subScores = available.map((sub) => ({
    ...sub,
    weight: totalWeight > 0 ? sub.weight / totalWeight : 1 / available.length,
  }));

  const score = Math.round(subScores.reduce((sum, s) => sum + s.score * s.weight, 0));
  const grade = gradeFromScore(score);

  // Recommandations : 2-3 sous-scores les plus faibles (< 60).
  const recommendations = [...subScores]
    .filter((s) => s.score < 60)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => RECOMMENDATIONS[s.key](s, input));

  return { score, grade, subScores, recommendations };
}
