import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton, Text, Button } from '../../ui';

interface MonthNavigatorProps {
  month: Date;
  onChange: (date: Date) => void;
  className?: string;
}

const formatMonth = (month: Date) =>
  month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/**
 * Navigation de période.
 *
 * Une seule implémentation pour le desktop et la PWA (voir MMonthNavigator,
 * qui n'est plus qu'un adaptateur de contrat `YYYY-MM`). L'eyebrow « Période »
 * en capitales a disparu : le libellé du mois se suffit.
 */
export const MonthNavigator: React.FC<MonthNavigatorProps> = ({
  month,
  onChange,
  className = '',
}) => {
  const now = new Date();
  const isCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();

  return (
    <div className={`flex items-center justify-between gap-2 px-2 py-2 ${className}`}>
      <IconButton
        label="Mois précédent"
        variant="plain"
        size="sm"
        onClick={() => onChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </IconButton>

      <div className="flex min-w-0 flex-col items-center">
        <Text variant="headline" className="capitalize" truncate>
          {formatMonth(month)}
        </Text>
        {!isCurrentMonth && (
          <Button
            variant="plain"
            size="sm"
            className="min-h-6"
            onClick={() => onChange(new Date(now.getFullYear(), now.getMonth(), 1))}
          >
            Revenir à aujourd&apos;hui
          </Button>
        )}
      </div>

      <IconButton
        label="Mois suivant"
        variant="plain"
        size="sm"
        disabled={isCurrentMonth}
        onClick={() => onChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </IconButton>
    </div>
  );
};

export function getMonthRange(month: Date): { start: string; end: string } {
  const y = month.getFullYear();
  const m = month.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
