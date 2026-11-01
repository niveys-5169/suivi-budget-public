import React from 'react';
import { FormattedNumber } from 'react-intl';
import { parseCalendarDate, toCalendarKey } from '../../utils/date';

type MDateGroupHeaderProps = {
  date: string; // ISO 'YYYY-MM-DD'
  total: number;
  currency?: string;
};

function formatGroupDate(dateStr: string): string {
  const now = new Date();
  const today = toCalendarKey(now);
  const yesterday = toCalendarKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === yesterday) return 'Hier';
  return parseCalendarDate(dateStr)
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    .toUpperCase();
}

export const MDateGroupHeader: React.FC<MDateGroupHeaderProps> = ({
  date,
  total,
  currency = 'EUR',
}) => {
  return (
    <div className="density-group-header flex items-center justify-between px-4 py-2 bg-bg/50 backdrop-blur-sm">
      <h2 className="text-caption font-bold tracking-normal text-label-tertiary">
        {formatGroupDate(date)}
      </h2>
      <p className="text-caption font-bold tabular-nums text-label-tertiary">
        <FormattedNumber value={total} style="currency" currency={currency} />
      </p>
    </div>
  );
};
