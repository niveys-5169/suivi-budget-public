import { useMemo } from 'react';
import { buildWealthTimeline, type RawHistoryEntry } from '../utils/wealthTimeline';
import {
  appendLiveTodayPoint,
  computeWealthEvolution,
  periodRangeISO,
  type EvolutionPeriod,
  type LiveByCat,
  type WealthEvolution,
} from '../utils/wealthEvolution';
import type { OwnerScope } from './useWealthScope';

/**
 * Évolution chiffrée du patrimoine (total + par catégorie) sur une période.
 * Hook de dérivation pure : l'historique est fourni par l'appelant
 * (usePatrimoine), aucun listener Firestore supplémentaire.
 *
 * `liveByCat`, si fourni et que la fenêtre inclut aujourd'hui, ancre la valeur
 * de fin sur l'état live (le même que les Allocations) plutôt que sur le
 * dernier snapshot de placement_history.
 */
export function useWealthEvolution(
  history: RawHistoryEntry[],
  period: EvolutionPeriod,
  ownerScope: OwnerScope,
  custom?: { from: string; to?: string },
  liveByCat?: LiveByCat,
): WealthEvolution {
  const timeline = useMemo(
    () =>
      buildWealthTimeline(history, {
        ownerFilter: ownerScope === 'all' ? undefined : ownerScope,
      }),
    [history, ownerScope],
  );

  const customFrom = custom?.from;
  const customTo = custom?.to;
  return useMemo(() => {
    const now = new Date();
    const range = periodRangeISO(
      period,
      now,
      customFrom ? { from: customFrom, to: customTo } : undefined,
    );
    const todayISO = now.toISOString().split('T')[0]!;
    const includesToday = range.to === null || range.to >= todayISO;
    // Total live nul = données pas encore chargées : on n'ancre pas sur 0.
    const hasLiveData = liveByCat && Object.values(liveByCat).some((v) => v !== 0);
    const points =
      hasLiveData && includesToday ? appendLiveTodayPoint(timeline, liveByCat, now) : timeline;
    return computeWealthEvolution(points, range.from, range.to);
  }, [timeline, period, customFrom, customTo, liveByCat]);
}
