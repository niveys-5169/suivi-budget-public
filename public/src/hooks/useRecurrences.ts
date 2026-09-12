import { useCallback, useContext, useMemo, useState } from 'react';
import { useGlobalData } from '../context/GlobalDataContext';
import { useTransactions } from './useTransactions';
import { AppStateContext } from '../context/AppStateContext';
import { toast } from '../lib/toast';
import {
  computePeriodState,
  getApprovalAmount,
  getApprovalEntries,
  getApprovedTxIds,
  getDayOfMonth,
  getLinkCandidates,
  getPeriodKey,
  getRecurrenceCandidates,
  isSettled,
  needsAction,
  type RecurrencePeriodState,
  type RecurrenceState,
} from '../utils/recurrenceEngine';
import {
  addRecurrenceAlias,
  approveRecurrenceMatch,
  removeRecurrence,
  setRecurrenceActive,
  skipRecurrencePeriod,
  unapproveRecurrenceMonth,
  unlinkRecurrenceTx,
  unskipRecurrencePeriod,
  updateRecurrence,
} from './recurrencesService';
import type { Recurrence, Transaction } from '../types/banking.types';

/** Récurrence enrichie de son état pour la période affichée. Modèle de vue unique. */
export interface RecurrenceView extends Recurrence {
  periodKey: string;
  state: RecurrenceState;
  /** Transaction suggérée par le matcher, présente uniquement si `state === 'matched'`. */
  match: Transaction | null;
  /** Montant à afficher : approuvé → apparié → attendu. */
  displayAmount: number;
  occurrenceDate: string;
  isIncome: boolean;
}

export type RecurrenceSortKey = 'date' | 'amount' | 'label';

/**
 * Mois d'affectation d'une transaction. Règle unique de l'app : `moisAffectation`
 * prime sur la date réelle (une dépense de fin de mois peut être rattachée au
 * mois suivant). Auparavant chaque surface appliquait sa propre règle.
 */
function txMonthKey(tx: Transaction): string {
  return tx.moisAffectation || (tx.date || '').slice(0, 7);
}

/** Trie une liste de vues selon la clé et le sens donnés (copie, non mutant). */
export function sortRecurrenceViews(
  list: RecurrenceView[],
  sortBy: RecurrenceSortKey,
  sortDir: 'asc' | 'desc' = 'asc',
): RecurrenceView[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (sortBy === 'label') return dir * a.label.localeCompare(b.label, 'fr');
    if (sortBy === 'amount') {
      return dir * (Math.abs(a.displayAmount) - Math.abs(b.displayAmount));
    }
    return dir * (getDayOfMonth(a) - getDayOfMonth(b));
  });
}

/**
 * Façade unique des récurrences : un seul endroit où un état est décidé et où
 * une écriture est déclenchée. Toute surface (page de gestion, analyse, mobile,
 * badges de transaction) doit passer par ici plutôt que d'appeler
 * `recurrencesService` ou `recurrenceEngine` directement.
 *
 * @param monthKeyOverride mois à analyser (YYYY-MM). Par défaut, le mois courant
 *   de `AppStateContext`. `/recurring` a sa propre navigation temporelle et le
 *   fournit explicitement.
 */
export function useRecurrences(monthKeyOverride?: string) {
  const { recurrences } = useGlobalData();
  const { transactions, togglePointe, bulkUpdate } = useTransactions();
  // Lecture directe du contexte plutôt que via `useAppState()` : un écran qui
  // fournit son propre mois (comme /recurring, qui a sa navigation temporelle)
  // n'a pas à être monté sous un AppStateProvider.
  const appState = useContext(AppStateContext);
  const monthKey = monthKeyOverride ?? appState?.monthKey ?? new Date().toISOString().slice(0, 7);
  const periodKey = getPeriodKey(`${monthKey}-01`);

  const activeRecurrences = useMemo(() => recurrences.filter((r) => r.active), [recurrences]);

  /**
   * Récurrences en pause (`active === false`). Absentes des sélecteurs par état,
   * elles seraient sinon introuvables — donc ni éditables ni supprimables. Brutes
   * (pas d'état de période) : elles ne sont rendues que dans la section « Archivées ».
   */
  const archived = useMemo(() => recurrences.filter((r) => !r.active), [recurrences]);

  const monthTransactions = useMemo(
    () => transactions.filter((t) => txMonthKey(t) === monthKey),
    [transactions, monthKey],
  );

  /**
   * Vivier de la liaison MANUELLE : le mois affiché et ses deux voisins. Une
   * charge de février peut être débitée le 30 janvier — la limiter au mois
   * affiché la rendait tout simplement introuvable. Les états, eux, restent
   * calculés sur `monthTransactions` seul.
   */
  const linkPoolTransactions = useMemo(() => {
    const [year = NaN, month = NaN] = monthKey.split('-').map(Number);
    const shiftedKey = (delta: number) => {
      const d = new Date(year, month - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const window = new Set([shiftedKey(-1), monthKey, shiftedKey(1)]);
    return transactions.filter((t) => window.has(txMonthKey(t)));
  }, [transactions, monthKey]);

  /** Tx déjà liées à une récurrence : jamais proposées à une autre. */
  const approvedTxIds = useMemo(() => getApprovedTxIds(activeRecurrences), [activeRecurrences]);

  const items = useMemo((): RecurrenceView[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Une transaction ne peut être revendiquée que par une seule récurrence : on
    // l'ajoute aux exclusions dès qu'elle est appariée. Le parcours suit l'ordre
    // du jour du mois pour que le résultat ne dépende pas de l'ordre Firestore.
    const claimed = new Set(approvedTxIds);
    const ordered = [...activeRecurrences].sort((a, b) => getDayOfMonth(a) - getDayOfMonth(b));

    // Deux passes : les libellés reconnus (match fort) revendiquent leur
    // transaction avant les simples coïncidences de montant (match faible).
    // Sans cela, une récurrence placée tôt dans le mois pouvait rafler par un
    // match faible la transaction qu'une autre reconnaissait par son alias,
    // laissant cette dernière « en retard » alors que son paiement existe.
    const resolved = new Map<string, RecurrencePeriodState>();
    const claim = (result: RecurrencePeriodState) => {
      if (result.state === 'matched' && result.match?.tx.id) claimed.add(result.match.tx.id);
    };

    const weakOnly: typeof ordered = [];
    ordered.forEach((r) => {
      const probe = computePeriodState(r, periodKey, monthTransactions, today, claimed);
      if (probe.state === 'matched' && probe.match?.confidence !== 'strong') {
        weakOnly.push(r);
        return;
      }
      claim(probe);
      resolved.set(r.id, probe);
    });
    weakOnly.forEach((r) => {
      const result = computePeriodState(r, periodKey, monthTransactions, today, claimed);
      claim(result);
      resolved.set(r.id, result);
    });

    const views = ordered.flatMap((r): RecurrenceView[] => {
      const result = resolved.get(r.id);
      if (!result) return [];
      const approval = r.approvedMonths?.[periodKey];
      const displayAmount =
        result.state === 'approved' && approval
          ? getApprovalAmount(approval) || r.expectedAmount
          : result.state === 'matched'
            ? (result.match?.tx.montant ?? r.expectedAmount)
            : r.expectedAmount;

      return [
        {
          ...r,
          periodKey,
          state: result.state,
          match: result.state === 'matched' ? (result.match?.tx ?? null) : null,
          displayAmount,
          occurrenceDate: result.occurrenceDate,
          isIncome: r.expectedAmount > 0,
        },
      ];
    });

    return sortRecurrenceViews(views, 'date');
  }, [activeRecurrences, periodKey, monthTransactions, approvedTxIds]);

  const expenses = useMemo(() => items.filter((r) => !r.isIncome), [items]);
  const incomes = useMemo(() => items.filter((r) => r.isIncome), [items]);

  const byState = useMemo(() => {
    const groups: Record<RecurrenceState, RecurrenceView[]> = {
      approved: [],
      matched: [],
      skipped: [],
      expected: [],
      overdue: [],
    };
    items.forEach((r) => groups[r.state].push(r));
    return groups;
  }, [items]);

  const totals = useMemo(() => {
    const sumAbs = (list: RecurrenceView[], pick: (r: RecurrenceView) => number) =>
      list.reduce((sum, r) => sum + Math.abs(pick(r)), 0);

    return {
      /** Réellement approuvé ce mois (dépenses). Base du « Payé ce mois ». */
      approvedThisMonth: sumAbs(
        byState.approved.filter((r) => !r.isIncome),
        (r) => r.displayAmount,
      ),
      /** Engagement mensuel total : somme des montants attendus sortants. */
      commitment: sumAbs(expenses, (r) => r.expectedAmount),
      /** Reste à payer : ni réglé, ni ignoré. */
      remaining: sumAbs(
        expenses.filter((r) => !isSettled(r.state) && r.state !== 'skipped'),
        (r) => r.expectedAmount,
      ),
      /** Revenus récurrents déjà encaissés ce mois. */
      incomeReceived: sumAbs(
        incomes.filter((r) => isSettled(r.state)),
        (r) => r.displayAmount,
      ),
    };
  }, [byState, expenses, incomes]);

  /**
   * Badges des listes de transactions : tx liée (toutes périodes, pour que le
   * badge suive la transaction quel que soit le mois affiché) et tx candidate.
   */
  const mappings = useMemo(() => {
    const linkedTxToRecurrence: Record<string, Recurrence> = {};
    activeRecurrences.forEach((rec) => {
      Object.values(rec.approvedMonths || {}).forEach((approval) => {
        if (!approval) return;
        getApprovalEntries(approval).forEach((entry) => {
          if (entry.txId) linkedTxToRecurrence[entry.txId] = rec;
        });
      });
    });

    const candidateTxToRecurrence: Record<string, Recurrence> = {};
    items.forEach((view) => {
      if (view.match?.id) candidateTxToRecurrence[view.match.id] = view;
    });

    return { linkedTxToRecurrence, candidateTxToRecurrence };
  }, [activeRecurrences, items]);

  /**
   * Suggestions de rattachement écartées à la main, le temps de la session.
   * État de vue volontairement non persisté : la suggestion réapparaîtra au
   * prochain chargement, tant que la transaction n'est pas liée.
   */
  const [ignoredTxIds, setIgnoredTxIds] = useState<string[]>([]);
  const ignoreTxMatch = useCallback((txId: string) => {
    setIgnoredTxIds((prev) => (prev.includes(txId) ? prev : [...prev, txId]));
  }, []);

  /** Transactions proposées pour un rattachement manuel, classées. */
  const linkCandidates = useCallback(
    (rec: Recurrence, limit?: number) =>
      getLinkCandidates(rec, linkPoolTransactions, approvedTxIds, limit),
    [linkPoolTransactions, approvedTxIds],
  );

  /**
   * Sens inverse : récurrences proposées pour rattacher une transaction, classées.
   * Une récurrence déjà approuvée pour la période affichée est écartée — elle est
   * réglée, la proposer relancerait une liaison que l'écran /recurring vient de
   * clore. Les états `matched`, `skipped`, `expected` et `overdue` restent
   * proposables.
   */
  const recurrenceCandidates = useCallback(
    (tx: Transaction, limit?: number) =>
      getRecurrenceCandidates(
        tx,
        items.filter((r) => r.state !== 'approved'),
        limit,
      ),
    [items],
  );

  /** Enveloppe commune : une seule gestion d'erreur pour toutes les commandes. */
  const run = useCallback(async (action: () => Promise<void>, errorMessage: string) => {
    try {
      await action();
    } catch (err) {
      console.error(errorMessage, err);
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Lie une transaction à une récurrence pour le mois. Quatre effets, toujours
   * appliqués ensemble — c'est la raison d'être de la façade : l'apprentissage
   * de l'alias et le pointage n'existaient auparavant que sur certains écrans.
   *
   * Le quatrième — aligner la catégorie de la transaction sur celle de la
   * récurrence — garantit que le RAV et les dépenses constatées comptent la
   * charge dans la même catégorie que sa provision, y compris quand la
   * transaction était déjà catégorisée différemment (import, saisie manuelle).
   */
  const link = useCallback(
    (rec: Recurrence, tx: Transaction, targetPeriodKey = periodKey) =>
      run(async () => {
        await approveRecurrenceMatch(rec.id, targetPeriodKey, tx);
        if (tx.libelle) await addRecurrenceAlias(rec.id, tx.libelle);
        if (!tx.pointe) await togglePointe(tx.id, true);
        if (rec.category && (tx.categorie || '').trim() !== rec.category.trim()) {
          await bulkUpdate([tx.id], { categorie: rec.category });
        }
      }, 'Erreur lors du rattachement de la transaction'),
    [run, periodKey, togglePointe, bulkUpdate],
  );

  /** Approuve la transaction suggérée par le matcher. */
  const approve = useCallback(
    (view: RecurrenceView) => {
      if (!view.match) return Promise.resolve();
      return link(view, view.match, view.periodKey);
    },
    [link],
  );

  const unapprove = useCallback(
    (view: RecurrenceView) =>
      run(
        () => unapproveRecurrenceMonth(view.id, view.periodKey),
        "Erreur lors de l'annulation de l'approbation",
      ),
    [run],
  );

  /** Délie une seule transaction (les autres tx du même mois sont conservées). */
  const unlink = useCallback(
    (recurrenceId: string, txId: string) =>
      run(() => unlinkRecurrenceTx(recurrenceId, txId), 'Erreur lors du déliage de la transaction'),
    [run],
  );

  const skip = useCallback(
    (view: RecurrenceView) =>
      run(
        () => skipRecurrencePeriod(view.id, view.periodKey),
        'Erreur lors de la mise en pause de la récurrence',
      ),
    [run],
  );

  const unskip = useCallback(
    (view: RecurrenceView) =>
      run(
        () => unskipRecurrencePeriod(view.id, view.periodKey),
        'Erreur lors du rétablissement de la récurrence',
      ),
    [run],
  );

  const edit = useCallback(
    (
      id: string,
      patch: Partial<Pick<Recurrence, 'label' | 'category' | 'expectedAmount' | 'anchorDate'>>,
    ) => run(() => updateRecurrence(id, patch), 'Erreur lors de la modification de la récurrence'),
    [run],
  );

  const remove = useCallback(
    (id: string) => run(() => removeRecurrence(id), 'Erreur lors de la suppression'),
    [run],
  );

  const setActive = useCallback(
    (id: string, active: boolean) =>
      run(() => setRecurrenceActive(id, active), "Erreur lors du changement d'état"),
    [run],
  );

  return {
    // Contexte
    monthKey,
    periodKey,
    monthTransactions,
    hasRecurrences: recurrences.length > 0,

    // Sélecteurs
    items,
    expenses,
    incomes,
    archived,
    byState,
    totals,
    mappings,
    linkCandidates,
    recurrenceCandidates,
    needsAction,
    ignoredTxIds,
    ignoreTxMatch,

    // Commandes
    approve,
    unapprove,
    link,
    unlink,
    skip,
    unskip,
    edit,
    remove,
    setActive,
  };
}
