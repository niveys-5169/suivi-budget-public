import {
  Recurrence,
  RecurrenceApproval,
  RecurrenceApprovalEntry,
  Transaction,
  MonthOverride,
} from '../types/banking.types';

/**
 * Normalise un libellé pour la détection et la génération de clés.
 * Supprime les accents, caractères spéciaux et espaces superflus.
 */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-');
}

/**
 * Génère une clé stable pour une récurrence.
 * Priorité au slug du libellé pour la stabilité entre catégories/montants.
 */
export function getRecurringKey(r: { label?: string; category?: string; avgAmount?: number }) {
  if (r.label) {
    const slug = normalizeLabel(r.label);
    if (slug) return slug;
  }

  // Fallback sur l'ancienne méthode si pas de libellé (rare)
  const cat = String(r.category || '(Sans catégorie)')
    .trim()
    .toLowerCase();
  const bucket = Math.round(Math.abs(r.avgAmount || 0));
  return `${cat}||${bucket}`.replace(/\//g, '_');
}

/**
 * Fenêtre de tolérance (jours) entre la date attendue et une transaction
 * candidate. Une semaine pleine : un prélèvement calé un samedi part le lundi,
 * et un pont peut le décaler de deux jours de plus. Les faux positifs restent
 * bornés par les autres filtres du chemin faible (catégorie identique, montant
 * ±20 %, revendication unique).
 */
const DAY_WINDOW = 7;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface ParsedAnchor {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  date: Date;
}

function parseAnchor(anchorDate?: string): ParsedAnchor | null {
  if (!anchorDate) return null;
  const [y, m, d] = (anchorDate.split('T')[0] ?? '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d, date: new Date(y, m - 1, d) };
}

function isoDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateToISO(d: Date): string {
  return isoDateString(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Clé de période mensuelle (YYYY-MM) pour une date ISO donnée. */
export function getPeriodKey(dateISO: string): string {
  const d = dateISO.split('T')[0] ?? '';
  const [y = NaN, m = NaN] = d.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Jour du mois (1..31) d'une récurrence, dérivé d'`anchorDate` (ou `dayOfMonth`
 * en repli pour les documents existants créés avant son introduction).
 */
export function getDayOfMonth(rec: Recurrence): number {
  return parseAnchor(rec.anchorDate)?.day ?? rec.dayOfMonth ?? 1;
}

/**
 * Date attendue (ISO YYYY-MM-DD) d'une récurrence pour une période (YYYY-MM)
 * donnée. Le jour est calé sur `anchorDate` (ou `dayOfMonth` en repli pour les
 * documents existants sans anchorDate) et clampé à la fin du mois si besoin.
 */
export function getExpectedDate(rec: Recurrence, periodKey: string): string {
  const [y = NaN, m = NaN] = periodKey.split('-').map(Number);
  const day = Math.min(getDayOfMonth(rec), daysInMonth(y, m));
  return isoDateString(y, m, day);
}

export interface RecurrenceMatch {
  tx: Transaction;
  confidence: 'strong' | 'weak';
}

/**
 * Transactions liées d'une approbation mensuelle. Normalise les deux formes :
 * nouvelle (`entries[]`, plusieurs tx par mois) et ancienne (champs simples
 * txId/amount/date, une seule tx).
 */
export function getApprovalEntries(approval: RecurrenceApproval): RecurrenceApprovalEntry[] {
  if (approval.entries?.length) return approval.entries;
  return approval.txId
    ? [{ txId: approval.txId, amount: approval.amount, date: approval.date }]
    : [];
}

/** Montant total approuvé pour un mois (somme des transactions liées). */
export function getApprovalAmount(approval: RecurrenceApproval): number {
  return getApprovalEntries(approval).reduce((sum, e) => sum + (e.amount || 0), 0);
}

/**
 * Ensemble des `txId` déjà approuvés pour une récurrence (toutes périodes,
 * toutes récurrences confondues). Sert à exclure ces transactions du
 * matching pour éviter qu'une transaction déjà liée à une récurrence soit
 * proposée pour une autre.
 */
export function getApprovedTxIds(recurrences: Recurrence[]): Set<string> {
  const ids = new Set<string>();
  recurrences.forEach((r) => {
    Object.values(r.approvedMonths || {}).forEach((a) => {
      if (!a) return;
      getApprovalEntries(a).forEach((e) => {
        if (e.txId) ids.add(e.txId);
      });
    });
  });
  return ids;
}

/**
 * Écart en jours entre la date d'une transaction et la date attendue de la
 * récurrence pour le mois de cette transaction. `null` si la date est illisible.
 */
function dayDiffToExpected(rec: Recurrence, tx: Transaction): number | null {
  const dateStr = (tx.date || '').split('T')[0] ?? '';
  const dateParts = dateStr.split('-');
  if (dateParts.length !== 3 || dateParts.some((p) => !p || isNaN(Number(p)))) return null;
  const expected = getExpectedDate(rec, getPeriodKey(dateStr));
  return Math.round(
    Math.abs(new Date(dateStr).getTime() - new Date(expected).getTime()) / 86_400_000,
  );
}

/** Écart relatif de montant entre une transaction et le montant attendu. */
function amountGap(targetAmount: number, txAmount: number): number {
  return targetAmount > 0 ? Math.abs(txAmount - targetAmount) / targetAmount : 0;
}

/**
 * Recherche une transaction correspondant à une récurrence parmi `txs`.
 *
 * Le SIGNE doit toujours concorder : un encaissement ne règle jamais une
 * charge. C'est le seul prérequis commun aux deux chemins.
 *
 * 1. Alias exact (normalizeLabel(tx.libelle) ∈ rec.aliases) + montant ±30 %
 *    → match fort. La catégorie n'entre PAS en jeu ici : un libellé déjà appris
 *    est un signal plus fort qu'elle, et la transaction est souvent justement
 *    mal (ou pas) catégorisée — c'est le cas que ce chemin doit rattraper.
 * 2. Sinon, catégorie identique (insensible à la casse, trim) — ÉLIMINATOIRE,
 *    car sans libellé reconnu c'est le seul signal fiable — + montant ±20 % +
 *    proximité de date (±`DAY_WINDOW` jours) → match faible.
 *
 * Dans les deux cas on retient le candidat au score le plus bas (écart de
 * montant + écart de date), un match fort primant toujours sur un faible.
 *
 * `excludeTxIds`, si fourni, écarte les transactions déjà liées à une autre
 * récurrence.
 */
export function matchTransaction(
  rec: Recurrence,
  txs: Transaction[],
  excludeTxIds?: Set<string>,
): RecurrenceMatch | null {
  const targetAmount = Math.abs(rec.expectedAmount);
  const targetCategory = rec.category.trim().toLowerCase();
  const aliasSet = new Set((rec.aliases ?? []).map(normalizeLabel));

  let best: { tx: Transaction; score: number; confidence: 'strong' | 'weak' } | null = null;

  for (const tx of txs) {
    if (tx.id && excludeTxIds?.has(tx.id)) continue;
    if (Math.sign(tx.montant ?? 0) !== Math.sign(rec.expectedAmount)) continue;

    const txAmount = Math.abs(tx.montant ?? 0);
    const isAliasMatch = aliasSet.size > 0 && aliasSet.has(normalizeLabel(tx.libelle || ''));

    if (isAliasMatch) {
      const withinAliasTolerance =
        targetAmount === 0 ? txAmount === 0 : amountGap(targetAmount, txAmount) <= 0.3;
      if (!withinAliasTolerance) continue;
      // Plusieurs transactions peuvent porter le même libellé dans le mois : on
      // départage sur montant + date au lieu de figer la première rencontrée.
      const score =
        amountGap(targetAmount, txAmount) + (dayDiffToExpected(rec, tx) ?? DAY_WINDOW) / 31;
      if (!best || best.confidence !== 'strong' || score < best.score) {
        best = { tx, score, confidence: 'strong' };
      }
      continue;
    }

    if (best?.confidence === 'strong') continue;

    if ((tx.categorie || '').trim().toLowerCase() !== targetCategory) continue;

    const withinTolerance =
      targetAmount === 0 ? txAmount === 0 : amountGap(targetAmount, txAmount) <= 0.2;
    if (!withinTolerance) continue;

    const dayDiff = dayDiffToExpected(rec, tx);
    if (dayDiff === null || dayDiff > DAY_WINDOW) continue;

    const score = amountGap(targetAmount, txAmount) + dayDiff / 31;
    if (!best || score < best.score) {
      best = { tx, score, confidence: 'weak' };
    }
  }

  return best ? { tx: best.tx, confidence: best.confidence } : null;
}

export interface UpcomingOccurrence {
  periodKey: string;
  date: string;
}

/**
 * Échéances attendues d'une récurrence dans la fenêtre [`from`, `from` + `days`]
 * (bornes incluses), une par mois distinct rencontré dans la fenêtre. Exclut
 * les échéances dont la date attendue est déjà passée par rapport à `from`.
 */
export function getUpcomingOccurrences(
  rec: Recurrence,
  from: Date,
  days: number,
): UpcomingOccurrence[] {
  const fromKey = dateToISO(from);
  const toDate = new Date(from);
  toDate.setDate(toDate.getDate() + days);
  const toKey = dateToISO(toDate);

  const occurrences: UpcomingOccurrence[] = [];
  const seenPeriods = new Set<string>();
  const cursor = new Date(from);

  while (dateToISO(cursor) <= toKey) {
    const periodKey = getPeriodKey(dateToISO(cursor));
    if (!seenPeriods.has(periodKey)) {
      seenPeriods.add(periodKey);
      const date = getExpectedDate(rec, periodKey);
      if (date >= fromKey && date <= toKey) {
        occurrences.push({ periodKey, date });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * État canonique d'une récurrence pour une période. Unique automate de l'app :
 * toute surface (page de gestion, analyse, mobile, RAV, alertes) le consomme.
 *
 * `approved` et `matched` ne doivent PAS être confondus : le premier est une
 * validation explicite de l'utilisateur, le second une simple suggestion du
 * matcher. Les deux signifient en revanche que de l'argent est sorti du compte
 * — d'où `isSettled`, qui distingue cet axe de l'axe « validé ».
 */
export type RecurrenceState =
  | 'approved' // approvedMonths[periodKey] existe — validé par l'utilisateur
  | 'matched' // une tx correspond, non approuvée — argent sorti, à confirmer
  | 'skipped' // periodKey ∈ skippedPeriods
  | 'expected' // échéance à venir, rien trouvé
  | 'overdue'; // échéance dépassée, rien trouvé

/**
 * Argent constaté sur le compte : la dépense ne doit plus être provisionnée
 * (RAV, prévisionnel), sous peine de la compter deux fois.
 */
export function isSettled(state: RecurrenceState): boolean {
  return state === 'approved' || state === 'matched';
}

/** Demande une action de l'utilisateur (badge, section « En attente »). */
export function needsAction(state: RecurrenceState): boolean {
  return state === 'matched' || state === 'overdue';
}

export interface RecurrencePeriodState {
  state: RecurrenceState;
  effectiveAmount: number;
  occurrenceDate: string;
  /** Renseigné pour l'état `matched` uniquement (pas sur une approbation). */
  match?: RecurrenceMatch;
  monthOverride?: MonthOverride;
}

/** État d'une récurrence pour une période donnée. */
export function computePeriodState(
  rec: Recurrence,
  periodKey: string,
  periodTransactions: Transaction[],
  today: Date,
  excludeTxIds?: Set<string>,
): RecurrencePeriodState {
  const expectedDate = getExpectedDate(rec, periodKey);
  const approval = rec.approvedMonths?.[periodKey];

  if (approval) {
    const totalAmount = getApprovalAmount(approval);
    return {
      state: 'approved',
      effectiveAmount: totalAmount,
      occurrenceDate: approval.date,
      monthOverride: {
        linkedTxId: approval.txId,
        linkedAmount: totalAmount,
        linkedDate: approval.date,
      },
    };
  }

  if (rec.skippedPeriods?.includes(periodKey)) {
    return {
      state: 'skipped',
      effectiveAmount: rec.expectedAmount,
      occurrenceDate: expectedDate,
      monthOverride: { skipped: true },
    };
  }

  const match = matchTransaction(rec, periodTransactions, excludeTxIds);
  if (match) {
    const date = (match.tx.date || expectedDate).split('T')[0] ?? expectedDate;
    const amount = match.tx.montant ?? rec.expectedAmount;
    return {
      state: 'matched',
      effectiveAmount: amount,
      occurrenceDate: date,
      match,
      monthOverride: { linkedTxId: match.tx.id, linkedAmount: amount, linkedDate: date },
    };
  }

  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const daysUntil = Math.round(
    (new Date(expectedDate).getTime() - todayMidnight.getTime()) / 86_400_000,
  );

  return {
    state: daysUntil < 0 ? 'overdue' : 'expected',
    effectiveAmount: rec.expectedAmount,
    occurrenceDate: expectedDate,
  };
}

/**
 * Score d'affinité entre une récurrence et une transaction. Plus bas = meilleur.
 *
 * Score mixte : une autre catégorie coûte l'équivalent de 100 % d'écart de
 * montant. Une transaction mal catégorisée mais au montant exact peut donc
 * devancer une même-catégorie très éloignée — c'est voulu, elle est souvent le
 * bon candidat. La proximité de date départage à montant égal (au plus 100 %
 * d'écart, pour ne pas écraser les deux autres termes), et un signe opposé est
 * relégué sans jamais être exclu — c'est l'utilisateur qui tranche.
 */
function linkScore(rec: Recurrence, tx: Transaction): number {
  const targetAmount = Math.abs(rec.expectedAmount);
  const txAmount = Math.abs(tx.montant ?? 0);
  const sameCategory =
    (tx.categorie || '').trim().toLowerCase() === rec.category.trim().toLowerCase();
  const amountDiff = targetAmount > 0 ? Math.abs(txAmount - targetAmount) / targetAmount : 1;
  const dateGap = Math.min(dayDiffToExpected(rec, tx) ?? 31, 31) / 31;
  const wrongSign = Math.sign(tx.montant ?? 0) !== Math.sign(rec.expectedAmount) ? 2 : 0;
  return (sameCategory ? 0 : 1) + amountDiff + dateGap + wrongSign;
}

/**
 * Transactions proposées pour un rattachement MANUEL, classées par pertinence.
 *
 * Volontairement plus permissif que `matchTransaction` : ici l'utilisateur
 * choisit lui-même, donc la catégorie n'est pas éliminatoire — elle classe
 * seulement en tête. C'est le pendant assumé de la règle stricte du matching
 * automatique, pas un oubli.
 *
 * Remplace les barèmes ad-hoc qui existaient dans chaque modal de liaison.
 */
export function getLinkCandidates(
  rec: Recurrence,
  txs: Transaction[],
  excludeTxIds?: Set<string>,
  limit = 50,
): Transaction[] {
  return txs
    .filter((tx) => !(tx.id && excludeTxIds?.has(tx.id)))
    .map((tx) => ({ tx, score: linkScore(rec, tx) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((c) => c.tx);
}

/**
 * Symétrique de `getLinkCandidates` : récurrences proposées pour rattacher une
 * transaction, classées par le MÊME barème. Le sens « transaction → récurrence »
 * ne doit pas inventer son propre score, sous peine de proposer un ordre
 * différent des deux côtés de la même liaison.
 *
 * Générique pour laisser passer une `RecurrenceView` enrichie sans la dégrader.
 */
export function getRecurrenceCandidates<R extends Recurrence>(
  tx: Transaction,
  recurrences: R[],
  limit = 20,
): R[] {
  return recurrences
    .map((rec) => ({ rec, score: linkScore(rec, tx) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((c) => c.rec);
}
