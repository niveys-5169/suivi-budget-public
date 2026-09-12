import React from 'react';
import { useIntl } from 'react-intl';
import { PeriodPills } from '../../components/shared/PeriodPills';
import { useWealthEvolution } from '../../hooks/useWealthEvolution';
import type { EvolutionPeriod, CatEvolution, LiveByCat } from '../../utils/wealthEvolution';
import type { RawHistoryEntry, WealthCategory } from '../../utils/wealthTimeline';
import type { OwnerScope } from '../../hooks/useWealthScope';
import { formatCurrency } from '../../lib/formatters';

const CAT_ORDER: WealthCategory[] = ['courants', 'epargne', 'investissements', 'retraite'];

const CAT_LABEL_IDS: Record<WealthCategory, string> = {
  courants: 'wealth.kpi.cash',
  epargne: 'wealth.kpi.savings',
  investissements: 'wealth.kpi.investments',
  retraite: 'wealth.evolution.cat.retirement',
};

const CAT_TO_SCOPE_KEY: Record<WealthCategory, string> = {
  courants: 'courants',
  epargne: 'epargnelivrets',
  investissements: 'investissements',
  retraite: 'retraite',
};

const eur = (v: number) => formatCurrency(v, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });

const DeltaChip: React.FC<{ evo: CatEvolution }> = ({ evo }) => {
  const positive = evo.delta >= 0;
  const cls =
    evo.delta === 0
      ? 'bg-white/5 text-label-tertiary'
      : positive
        ? 'bg-positive/10 text-positive'
        : 'bg-negative/10 text-negative';
  return (
    <span
      className={`px-2 py-1 rounded-full text-caption font-bold tabular-nums whitespace-nowrap ${cls}`}
    >
      {positive ? '+' : ''}
      {eur(evo.delta)}
      {evo.deltaPct !== null && ` (${positive ? '+' : ''}${evo.deltaPct.toFixed(1)}%)`}
    </span>
  );
};

interface MWealthEvolutionCardProps {
  history: RawHistoryEntry[];
  ownerScope: OwnerScope;
  wealthTypeScope: string[] | 'all';
  /** Période contrôlée par l'écran parent — sélecteur unique pour toute la section Évolution. */
  period: EvolutionPeriod;
  onPeriodChange: (period: EvolutionPeriod) => void;
  /** Valeurs live par catégorie (mêmes que les Allocations) — ancre la valeur de fin. */
  liveByCat?: LiveByCat;
}

/** Évolution chiffrée compacte (mobile) : delta par catégorie + total sur la période choisie. */
export const MWealthEvolutionCard: React.FC<MWealthEvolutionCardProps> = ({
  history,
  ownerScope,
  wealthTypeScope,
  period,
  onPeriodChange,
  liveByCat,
}) => {
  const { formatMessage: t } = useIntl();
  const evolution = useWealthEvolution(history, period, ownerScope, undefined, liveByCat);

  const visibleCats = CAT_ORDER.filter(
    (cat) =>
      wealthTypeScope === 'all' ||
      wealthTypeScope.length === 0 ||
      wealthTypeScope.includes(CAT_TO_SCOPE_KEY[cat]),
  );

  // Total limité aux catégories visibles : evolution.total somme TOUTES les
  // catégories, y compris celles masquées par le filtre de type — ce qui
  // affichait un TOTAL différent du hero « Valeur nette totale ».
  const totalEvo: CatEvolution = (() => {
    if (visibleCats.length === CAT_ORDER.length) return evolution.total;
    const start = visibleCats.reduce((s, cat) => s + evolution.byCat[cat].start, 0);
    const end = visibleCats.reduce((s, cat) => s + evolution.byCat[cat].end, 0);
    const delta = end - start;
    return { start, end, delta, deltaPct: start !== 0 ? (delta / start) * 100 : null };
  })();

  return (
    <div className="bg-surface border border-separator rounded-lg p-4 space-y-4">
      <PeriodPills
        periods={['1M', '6M', '1Y', 'ytd', 'all']}
        value={period}
        onChange={onPeriodChange}
      />

      {!evolution.endPoint ? (
        <p className="text-footnote text-label-tertiary py-2">
          {t({ id: 'wealth.evolution.noData' })}
        </p>
      ) : (
        <div className="space-y-1">
          {visibleCats.map((cat) => {
            const evo = evolution.byCat[cat];
            if (evo.start === 0 && evo.end === 0) return null;
            return (
              <div
                key={cat}
                className="flex items-center justify-between gap-2 py-2 border-b border-separator"
              >
                <span className="text-footnote font-medium text-label-secondary truncate">
                  {t({ id: CAT_LABEL_IDS[cat] })}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-footnote font-bold tabular-nums text-white">
                    {eur(evo.end)}
                  </span>
                  <DeltaChip evo={evo} />
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-footnote font-semibold text-white">
              {t({ id: 'wealth.evolution.total' })}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-footnote font-bold tabular-nums text-white">
                {eur(totalEvo.end)}
              </span>
              <DeltaChip evo={totalEvo} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
