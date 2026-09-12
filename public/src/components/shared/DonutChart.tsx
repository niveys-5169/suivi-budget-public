import React, { useState, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

export interface DonutData {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutData[];
  centerAmount: string;
  centerLabel: string;
  /** Index persistant (clic) — null = total affiché au centre */
  activeIndex: number | null;
  onSegmentClick: (index: number | null) => void;
}
interface SectorProps {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
  index?: number;
}

/** Shape du segment actif : élargie, opaque */
const renderActiveShape = (props: SectorProps) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={(outerRadius || 0) + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
};

/** Shape standard avec atténuation si un autre segment est sélectionné */
const buildShape = (dimmedFn: (index: number) => boolean) => {
  const Shape = (props: SectorProps) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, index } = props;
    if (cx === undefined || cy === undefined) return null;
    const isDimmed = index !== undefined && dimmedFn(index);
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        fillOpacity={isDimmed ? 0.3 : 1}
      />
    );
  };
  Shape.displayName = 'DonutShape';
  return Shape;
};

const DonutChartImpl: React.FC<Props> = ({
  data,
  centerAmount,
  centerLabel,
  activeIndex,
  onSegmentClick,
}) => {
  /** Index survolé : feedback visuel local, ne change pas le centre */
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { chartData, isEmpty } = useMemo(() => {
    const activeData = data.filter((d) => d.value > 0);
    const empty = activeData.length === 0;
    return {
      chartData: empty ? [{ label: 'Aucune donnée', value: 1, color: '#1C2130' }] : activeData,
      isEmpty: empty,
    };
  }, [data]);

  /** L'index affiché en activeShape : priorité au clic, sinon le hover */
  const displayActive = activeIndex ?? hoveredIndex;

  const handleClick = useCallback(
    (_: unknown, index: number) => {
      if (isEmpty) return;
      onSegmentClick(activeIndex === index ? null : index);
    },
    [isEmpty, activeIndex, onSegmentClick],
  );

  const handleMouseEnter = useCallback(
    (_: unknown, index: number) => {
      if (!isEmpty) setHoveredIndex(index);
    },
    [isEmpty],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  /** La catégorie dont on affiche les infos au centre */
  const focusedEntry = activeIndex !== null && !isEmpty ? chartData[activeIndex] : null;

  const inactiveShape = useMemo(
    () => buildShape((i) => displayActive !== null && displayActive !== i),
    [displayActive],
  );

  const CustomTooltip = useCallback(
    ({ active, payload }: { active?: boolean; payload?: { payload: DonutData }[] }) => {
      if (active && payload && payload.length) {
        const data = payload[0]!.payload;
        return (
          <div className="bg-bg border border-separator rounded-xl px-4 py-2 flex items-center gap-2 pointer-events-none z-[100]">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="text-caption font-bold text-white whitespace-nowrap">
              {data.label}
            </span>
          </div>
        );
      }
      return null;
    },
    [],
  );

  return (
    <div className="relative w-full aspect-square max-w-[280px] mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="90%"
            paddingAngle={chartData.length > 1 ? 3 : 0}
            dataKey="value"
            stroke="none"
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
            // Recharts Pie type definitions do not officially expose these properties in all versions. We cast explicitly to bypass this.
            {...({
              activeIndex: displayActive ?? undefined,
              activeShape: renderActiveShape,
              inactiveShape: inactiveShape,
            } as {
              activeIndex?: number;
              activeShape?: (props: SectorProps) => React.ReactElement | null;
              inactiveShape?: (props: SectorProps) => React.ReactElement | null;
            })}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: isEmpty ? 'default' : 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Centre : catégorie sélectionnée (clic) ou total */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <AnimatePresence mode="wait">
          {focusedEntry ? (
            <motion.div
              key={focusedEntry.label}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ duration: 0.16 }}
              className="flex flex-col items-center gap-1"
            >
              <span
                className="w-2 h-2 rounded-full mb-1"
                style={{ backgroundColor: focusedEntry.color }}
              />
              <span className="font-serif text-2xl font-semibold text-label [font-variant-numeric:tabular-nums] leading-none">
                {centerAmount}
              </span>
              <span
                className="text-caption font-bold leading-tight text-center px-4 line-clamp-2 max-w-[130px] mt-1"
                style={{ color: focusedEntry.color }}
              >
                {focusedEntry.label}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="total"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ duration: 0.16 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="font-serif text-3xl font-semibold text-label [font-variant-numeric:tabular-nums] leading-none">
                {centerAmount}
              </span>
              <span className="text-caption font-bold text-label-tertiary mt-1">{centerLabel}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const DonutChart = React.memo(DonutChartImpl);
