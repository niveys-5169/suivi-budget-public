import React from 'react';
import { FormattedNumber } from 'react-intl';

interface MDashboardSummaryProps {
  entrees: number;
  sorties: number;
}

export const MDashboardSummary: React.FC<MDashboardSummaryProps> = ({ entrees, sorties }) => {
  return (
    <div className="grid grid-cols-2 gap-4 px-4 pb-4">
      <div className="bg-surface border border-separator rounded-lg p-4">
        <p className="text-caption font-bold text-label-tertiary mb-1">Entrées</p>
        <p className="text-headline font-bold text-positive tabular-nums">
          +<FormattedNumber value={entrees} style="currency" currency="EUR" />
        </p>
      </div>
      <div className="bg-surface border border-separator rounded-lg p-4">
        <p className="text-caption font-bold text-label-tertiary mb-1">Sorties</p>
        <p className="text-headline font-bold text-negative tabular-nums">
          -<FormattedNumber value={Math.abs(sorties)} style="currency" currency="EUR" />
        </p>
      </div>
    </div>
  );
};
