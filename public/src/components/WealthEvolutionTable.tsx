import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { Card } from './shared/Card';
import { PeriodPills } from './shared/PeriodPills';
import { useWealthEvolution } from '../hooks/useWealthEvolution';
import type { EvolutionPeriod, CatEvolution, LiveByCat } from '../utils/wealthEvolution';
import type { RawHistoryEntry, WealthCategory } from '../utils/wealthTimeline';
import type { OwnerScope } from '../hooks/useWealthScope';
import { fmt } from '../utils/format';

const CAT_ORDER: WealthCategory[] = ['courants', 'epargne', 'investissements', 'retraite'];

const CAT_LABEL_IDS: Record<WealthCategory, string> = {
  courants: 'wealth.kpi.cash',
  epargne: 'wealth.kpi.savings',
  investissements: 'wealth.kpi.investments',
  retraite: 'wealth.evolution.cat.retirement',
};

/** WealthCategory → clé de wealthTypeScope (format graphique). */
const CAT_TO_SCOPE_KEY: Record<WealthCategory, string> = {
  courants: 'courants',
  epargne: 'epargnelivrets',
  investissements: 'investissements',
  retraite: 'retraite',
};

const DATE_INPUT_CLS =
  'min-h-[40px] px-4 bg-white/5 border border-separator rounded-xl text-white text-sm font-medium focus:outline-none focus:border-gold/50 transition-colors [color-scheme:dark]';

export const DeltaValue: React.FC<{ delta: number; pct: number | null }> = ({ delta, pct }) => {
  const positive = delta >= 0;
  const cls = delta === 0 ? 'text-label-tertiary' : positive ? 'text-positive' : 'text-negative';
  return (
    <span className={`font-bold tabular-nums ${cls}`}>
      {positive ? '+' : ''}
      {fmt(delta)}
      <span className="ml-2 font-medium opacity-80">
        {pct === null ? '—' : `${positive ? '+' : ''}${pct.toFixed(1)}%`}
      </span>
    </span>
  );
};

interface WealthEvolutionTableProps {
  history: RawHistoryEntry[];
  ownerScope: OwnerScope;
  wealthTypeScope: string[] | 'all';
  /** Valeurs live par catégorie (mêmes que les Allocations) — ancre la valeur « Fin ». */
  liveByCat?: LiveByCat;
}

/** Évolution chiffrée du patrimoine : tableau Début / Fin / Variation par catégorie. */
export const WealthEvolutionTable: React.FC<WealthEvolutionTableProps> = ({
  history,
  ownerScope,
  wealthTypeScope,
  liveByCat,
}) => {
  const { formatMessage: t } = useIntl();
  const [period, setPeriod] = useState<EvolutionPeriod>('1M');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const evolution = useWealthEvolution(
    history,
    period,
    ownerScope,
    period === 'custom' && customFrom ? { from: customFrom, to: customTo || undefined } : undefined,
    liveByCat,
  );

  const visibleCats = CAT_ORDER.filter(
    (cat) =>
      wealthTypeScope === 'all' ||
      wealthTypeScope.length === 0 ||
      wealthTypeScope.includes(CAT_TO_SCOPE_KEY[cat]),
  );

  const rows: { key: string; label: string; evo: CatEvolution; emphasis?: boolean }[] = [
    ...visibleCats.map((cat) => ({
      key: cat,
      label: t({ id: CAT_LABEL_IDS[cat] }),
      evo: evolution.byCat[cat],
    })),
    {
      key: 'total',
      label: t({ id: 'wealth.evolution.total' }),
      evo: evolution.total,
      emphasis: true,
    },
  ];

  return (
    <Card variant="subtle" padding="md" className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm md:text-base font-semibold text-white/80">
            {t({ id: 'wealth.evolution.title' })}
          </h2>
          {evolution.startPoint && evolution.endPoint && (
            <p className="text-caption text-label-tertiary mt-1">
              {t(
                { id: 'wealth.evolution.range' },
                { from: evolution.startPoint.fullDate, to: evolution.endPoint.fullDate },
              )}
            </p>
          )}
        </div>
        <PeriodPills
          periods={['1M', '3M', '6M', '1Y', 'ytd', 'all', 'custom']}
          value={period}
          onChange={setPeriod}
          className="lg:max-w-xl"
        />
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-caption font-bold text-label-tertiary">
            {t({ id: 'wealth.evolution.col.start' })}
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={DATE_INPUT_CLS}
            />
          </label>
          <label className="flex items-center gap-2 text-caption font-bold text-label-tertiary">
            {t({ id: 'wealth.evolution.col.end' })}
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className={DATE_INPUT_CLS}
            />
          </label>
        </div>
      )}

      {!evolution.endPoint ? (
        <p className="text-sm text-label-tertiary py-4">{t({ id: 'wealth.evolution.noData' })}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-caption font-bold text-label-tertiary border-b border-separator">
                <th className="text-left py-2 pr-4 font-bold" />
                <th className="text-right py-2 px-4 font-bold">
                  {t({ id: 'wealth.evolution.col.start' })}
                </th>
                <th className="text-right py-2 px-4 font-bold">
                  {t({ id: 'wealth.evolution.col.end' })}
                </th>
                <th className="text-right py-2 pl-4 font-bold">
                  {t({ id: 'wealth.evolution.col.delta' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, label, evo, emphasis }) => (
                <tr
                  key={key}
                  className={`border-b border-separator last:border-b-0 ${
                    emphasis ? 'bg-surface' : ''
                  }`}
                >
                  <td
                    className={`py-4 pr-4 ${
                      emphasis ? 'font-semibold text-white' : 'font-medium text-label-secondary'
                    }`}
                  >
                    {label}
                  </td>
                  <td className="text-right py-4 px-4 tabular-nums text-label-secondary">
                    {fmt(evo.start)}
                  </td>
                  <td
                    className={`text-right py-4 px-4 tabular-nums ${
                      emphasis ? 'font-bold text-white' : 'text-zinc-200'
                    }`}
                  >
                    {fmt(evo.end)}
                  </td>
                  <td className="text-right py-4 pl-4">
                    <DeltaValue delta={evo.delta} pct={evo.deltaPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
