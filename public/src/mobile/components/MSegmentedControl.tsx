import React from 'react';
import { SegmentedControl } from '../../ui';

export type AnalyseMode = 'sorties' | 'entrees';

interface MSegmentedControlProps {
  value: AnalyseMode;
  onChange: (val: AnalyseMode) => void;
}

const MODES = [
  { value: 'sorties', label: 'Sorties' },
  { value: 'entrees', label: 'Entrées' },
] as const satisfies readonly { value: AnalyseMode; label: string }[];

/**
 * Sélecteur de mode de l'écran Analyse.
 *
 * N'est plus qu'un préréglage de <SegmentedControl>. Trois implémentations du
 * même composant coexistaient (celle-ci, shared/PeriodPills et
 * mobile/components/shared/Segmented) en émettant déjà les mêmes classes.
 */
export const MSegmentedControl: React.FC<MSegmentedControlProps> = ({ value, onChange }) => (
  <div className="px-4 py-2">
    <SegmentedControl
      label="Mode d'analyse"
      segments={MODES}
      value={value}
      onChange={onChange}
      block
    />
  </div>
);
