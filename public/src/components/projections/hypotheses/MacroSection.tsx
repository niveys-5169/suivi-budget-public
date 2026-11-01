import React from 'react';
import type { SectionProps } from './editorTypes';
import { NumberField } from './FormFields';

export const MacroSection: React.FC<SectionProps> = ({ draft, onChange }) => (
  <NumberField
    label="Inflation annuelle"
    hint="Indexe les dépenses courantes et les pensions au 1er janvier"
    percent
    value={draft.macro.inflation}
    onChange={(v) => onChange({ ...draft, macro: { ...draft.macro, inflation: v ?? 0 } })}
  />
);
