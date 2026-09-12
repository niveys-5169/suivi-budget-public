import React from 'react';
import { FormattedNumber } from 'react-intl';

type MDateGroupHeaderProps = {
  date: string; // ISO 'YYYY-MM-DD'
  total: number;
  currency?: string;
};

function formatGroupDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === yesterday) return 'Hier';
  return new Date(dateStr)
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
