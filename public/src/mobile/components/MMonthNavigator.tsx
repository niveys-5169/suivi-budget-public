import React from 'react';
import { MonthNavigator } from '../../components/shared/MonthNavigator';

interface MMonthNavigatorProps {
  /** Clé de mois `YYYY-MM`. */
  monthKey: string;
  onChange: (newKey: string) => void;
}

const toMonthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Navigation de période côté PWA.
 *
 * N'est plus qu'un adaptateur de contrat : le rendu est celui de
 * <MonthNavigator>. Les deux composants étaient des forks au style divergent
 * (pilules rondes ici, boutons carrés côté desktop) parce que leurs contrats
 * différaient — `YYYY-MM` contre `Date`. C'est désormais la seule différence.
 */
export const MMonthNavigator: React.FC<MMonthNavigatorProps> = ({ monthKey, onChange }) => (
  <MonthNavigator
    month={new Date(`${monthKey}-01T00:00:00`)}
    onChange={(d) => onChange(toMonthKey(d))}
    className="shrink-0"
  />
);
