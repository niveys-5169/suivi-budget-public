import React, { useMemo, useState } from 'react';
import { CHART_COLORS } from '../lib/colors';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { SlidersHorizontal } from 'lucide-react';
import { fmt } from '../utils/format';
import {
  buildWealthTimeline,
  type RawHistoryEntry,
  type WealthCategory,
} from '../utils/wealthTimeline';

interface HistoryEntry {
  id?: string;
  assetId?: string;
  date?: string;
  owner?: string;
  type?: string;
  category?: string;
  montant?: number;
  amount?: number;
  value?: number;
}

type CategoryKey = 'courants' | 'epargnelivrets' | 'investissements' | 'retraite';

interface ChartDataPoint {
  timestamp: number;
  fullDate: string;
  courants: number;
  epargnelivrets: number;
  investissements: number;
  retraite: number;
  total: number;
}

interface WealthEvolutionBudgetChartProps {
  history: HistoryEntry[];
  owners: string[];
  selectedOwners: string[];
  onOwnersChange: (owners: string[]) => void;
  selectedTypes: CategoryKey[];
  onTypesChange: (types: CategoryKey[]) => void;
}

type TimeframePreset = '1M' | '6M' | '1Y' | 'defaut' | 'all' | 'custom';

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  courants: 'Liquidités',
  epargnelivrets: 'Épargne',
  investissements: 'Investissements',
  retraite: 'Retraite',
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  courants: CHART_COLORS.emerald, // Emerald
  epargnelivrets: CHART_COLORS.gold, // Gold
  investissements: '#3B82F6', // Blue
  retraite: '#A78BFA', // Light Violet / Lavender
};

const CATEGORY_MAPPING: Record<WealthCategory, CategoryKey> = {
  courants: 'courants',
  epargne: 'epargnelivrets',
  investissements: 'investissements',
  retraite: 'retraite',
};

const WealthEvolutionBudgetChartImpl: React.FC<WealthEvolutionBudgetChartProps> = ({
  history,
  owners,
  selectedOwners,
  onOwnersChange,
  selectedTypes,
  onTypesChange,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframePreset>('defaut');

  const todayStr = new Date().toISOString().split('T')[0]!;
  const [startDate, setStartDate] = useState('2024-02-01');
  const [endDate, setEndDate] = useState(todayStr);

  const handleTimeframeChange = (tf: TimeframePreset) => {
    setTimeframe(tf);
    const today = new Date();
    if (tf === '1M') {
      const prev = new Date(today);
      prev.setMonth(today.getMonth() - 1);
      setStartDate(prev.toISOString().split('T')[0]!);
      setEndDate(today.toISOString().split('T')[0]!);
    } else if (tf === '6M') {
      const prev = new Date(today);
      prev.setMonth(today.getMonth() - 6);
      setStartDate(prev.toISOString().split('T')[0]!);
      setEndDate(today.toISOString().split('T')[0]!);
    } else if (tf === '1Y') {
      const prev = new Date(today);
      prev.setFullYear(today.getFullYear() - 1);
      setStartDate(prev.toISOString().split('T')[0]!);
      setEndDate(today.toISOString().split('T')[0]!);
    } else if (tf === 'defaut') {
      setStartDate('2024-02-01');
      setEndDate(todayStr);
    } else if (tf === 'all') {
      const minDate =
        history.length > 0
          ? history
              .map((h) => h.date || '')
              .filter(Boolean)
              .sort()[0] || '2024-02-01'
          : '2024-02-01';
      setStartDate(minDate);
      setEndDate(todayStr);
    }
  };

  const { data, activeCategories } = useMemo(() => {
    const points = buildWealthTimeline(history as RawHistoryEntry[], {
      ownerFilter: selectedOwners,
    });

    const categoriesUsed = new Set<CategoryKey>();
    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();

    const chartData = points.map((p): ChartDataPoint => {
      const entry: ChartDataPoint = {
        timestamp: p.timestamp,
        fullDate: p.fullDate,
        courants: p.byCat.courants,
        epargnelivrets: p.byCat.epargne,
        investissements: p.byCat.investissements,
        retraite: p.byCat.retraite,
        total: p.amount,
      };

      (Object.keys(CATEGORY_MAPPING) as WealthCategory[]).forEach((wCat) => {
        if (p.byCat[wCat] > 0) {
          categoriesUsed.add(CATEGORY_MAPPING[wCat]);
        }
      });

      return entry;
    });

    const filteredChartData = chartData.filter(
      (pt) => pt.timestamp >= startTs && pt.timestamp <= endTs,
    );

    return {
      data: filteredChartData,
      activeCategories: (Object.keys(CATEGORY_LABELS) as CategoryKey[]).filter(
        (cat) =>
          categoriesUsed.has(cat) && (selectedTypes.length === 0 || selectedTypes.includes(cat)),
      ),
    };
  }, [history, selectedOwners, selectedTypes, startDate, endDate]);

  const filteredOwnerOptions = owners.filter(Boolean);

  const toggleOwner = (owner: string) => {
    onOwnersChange(
      selectedOwners.includes(owner)
        ? selectedOwners.filter((item) => item !== owner)
        : [...selectedOwners, owner],
    );
  };

  const toggleType = (type: keyof typeof CATEGORY_LABELS) => {
    onTypesChange(
      selectedTypes.includes(type)
        ? selectedTypes.filter((item) => item !== type)
        : [...selectedTypes, type],
    );
  };

  return (
    <section className="rounded-xl border border-separator bg-surface p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm md:text-base font-semibold text-white/80">
            Évolution Patrimoine (journalier)
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-caption font-bold transition-all hover:bg-white/10 ${
              showFilters
                ? 'bg-gold/10 border-gold/20 text-gold'
                : 'bg-white/5 border-separator text-label/70'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Filtres</span>
          </button>
        </div>

        {!showFilters && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-caption text-label-tertiary font-bold">
            <span>
              Période :{' '}
              <strong className="text-label/40">
                {timeframe === 'defaut'
                  ? 'Depuis fév. 24'
                  : timeframe === 'custom'
                    ? `${new Date(startDate).toLocaleDateString('fr-FR')} - ${new Date(
                        endDate,
                      ).toLocaleDateString('fr-FR')}`
                    : timeframe}
              </strong>
            </span>
            {selectedOwners.length > 0 && (
              <span>
                Propriétaires :{' '}
                <strong className="text-label/40">{selectedOwners.join(', ')}</strong>
              </span>
            )}
            {selectedTypes.length > 0 && (
              <span>
                Filtres positions :{' '}
                <strong className="text-label/40">
                  {selectedTypes.map((t) => CATEGORY_LABELS[t]).join(', ')}
                </strong>
              </span>
            )}
          </div>
        )}

        {showFilters && (
          <div className="p-4 rounded-lg bg-surface border border-separator space-y-4">
            <div className="space-y-2">
              <p className="text-caption text-white/40 font-bold">Propriétaires</p>
              <div className="flex flex-wrap gap-2">
                {filteredOwnerOptions.map((owner) => {
                  const active = selectedOwners.includes(owner);
                  return (
                    <button
                      key={owner}
                      onClick={() => toggleOwner(owner)}
                      className={`px-4 py-1 rounded-full text-caption font-semibold border transition-all ${
                        active
                          ? 'bg-gold text-bg border-gold'
                          : 'bg-transparent text-white/60 border-separator hover:text-white'
                      }`}
                    >
                      {owner}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-caption text-white/40 font-bold">Types de positions</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(
                  (type) => {
                    const active = selectedTypes.includes(type);
                    const color = CATEGORY_COLORS[type];
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        style={{
                          backgroundColor: active ? color : 'transparent',
                          borderColor: active ? color : `${color}40`,
                          color: active ? '#0B0B14' : color,
                        }}
                        className="px-4 py-1 rounded-full text-caption font-semibold border transition-all hover:brightness-110 active:scale-95"
                      >
                        {CATEGORY_LABELS[type]}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-caption text-white/40 font-bold">Période</p>
              <div className="flex flex-wrap gap-2">
                {(['1M', '6M', '1Y', 'defaut', 'all', 'custom'] as TimeframePreset[]).map(
                  (tfPreset) => {
                    const active = timeframe === tfPreset;
                    const labelMap: Record<TimeframePreset, string> = {
                      '1M': '1 Mois',
                      '6M': '6 Mois',
                      '1Y': '1 An',
                      defaut: 'Depuis fév. 24',
                      all: 'Tout',
                      custom: 'Perso',
                    };
                    return (
                      <button
                        key={tfPreset}
                        onClick={() => handleTimeframeChange(tfPreset)}
                        className={`px-4 py-1 rounded-full text-caption font-semibold border transition-all ${
                          active
                            ? 'bg-gold text-bg border-gold'
                            : 'bg-transparent text-white/60 border-separator hover:text-white'
                        }`}
                      >
                        {labelMap[tfPreset]}
                      </button>
                    );
                  },
                )}
              </div>
              {timeframe === 'custom' && (
                <div className="flex flex-wrap gap-4 mt-4">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="start-date"
                      className="text-caption text-label-tertiary font-bold"
                    >
                      Date de début
                    </label>
                    <input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-[#0B0B14] border border-separator rounded-lg text-white font-medium text-xs px-4 py-2 focus:outline-none focus:border-gold/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="end-date"
                      className="text-caption text-label-tertiary font-bold"
                    >
                      Date de fin
                    </label>
                    <input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-[#0B0B14] border border-separator rounded-lg text-white font-medium text-xs px-4 py-2 focus:outline-none focus:border-gold/40"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="h-64 md:h-80">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/35 text-xs">
            Aucune donnée avec ces filtres.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <defs>
                {activeCategories.map((cat) => (
                  <linearGradient
                    key={`grad-${cat}`}
                    id={`grad-${cat}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={CATEGORY_COLORS[cat]} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CATEGORY_COLORS[cat]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(ts) => {
                  const date = new Date(ts);
                  return date
                    .toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                    .replace('.', '');
                }}
                minTickGap={40}
              />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value, name) => [
                  fmt(Number(value)),
                  CATEGORY_LABELS[name as CategoryKey] || name,
                ]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                contentStyle={{
                  background: '#0B0B14',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  boxShadow: '0 10px 30px -5px rgba(0,0,0,0.5)',
                  padding: '12px 16px',
                }}
                itemStyle={{ fontSize: '11px', fontWeight: 600, color: '#fff', padding: '2px 0' }}
                labelStyle={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: '',
                  letterSpacing: '0.1em',
                  marginBottom: '8px',
                }}
                cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1 }}
              />
              {/* Render areas in order, stacked */}
              {activeCategories.map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="1"
                  stroke={CATEGORY_COLORS[cat]}
                  strokeWidth={2}
                  fill={`url(#grad-${cat})`}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: CATEGORY_COLORS[cat],
                    stroke: '#0B0B14',
                    strokeWidth: 2,
                  }}
                  animationDuration={1000}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};

export const WealthEvolutionBudgetChart = React.memo(WealthEvolutionBudgetChartImpl);
