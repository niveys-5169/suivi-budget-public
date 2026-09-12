import React from 'react';
import { useIntl } from 'react-intl';
import { SegmentedControl, type Segment } from '../../ui';
import type { EvolutionPeriod } from '../../utils/wealthEvolution';

const PERIOD_LABEL_IDS: Record<EvolutionPeriod, string> = {
  '1M': 'period.1m',
  '3M': 'period.3m',
  '6M': 'period.6m',
  '1Y': 'period.1y',
  ytd: 'period.ytd',
  all: 'period.all',
  custom: 'period.custom',
};

interface PeriodPillsProps {
  periods: EvolutionPeriod[];
  value: EvolutionPeriod;
  onChange: (period: EvolutionPeriod) => void;
  className?: string;
}

/**
 * Sélecteur de période d'analyse.
 *
 * Préréglage de <SegmentedControl> : les libellés ne sont plus en capitales.
 */
export const PeriodPills: React.FC<PeriodPillsProps> = ({
  periods,
  value,
  onChange,
  className = '',
}) => {
  const { formatMessage: t } = useIntl();
  const segments: Segment<EvolutionPeriod>[] = periods.map((p) => ({
    value: p,
    label: t({ id: PERIOD_LABEL_IDS[p] }),
  }));

  return (
    <SegmentedControl
      label="Période"
      segments={segments}
      value={value}
      onChange={onChange}
      block
      className={className}
    />
  );
};
