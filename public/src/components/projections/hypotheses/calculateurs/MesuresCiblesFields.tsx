import React from 'react';
import type { ProjectionActiviteParams, ProjectionScenario } from '../../../../types/banking.types';
import { NumberField } from '../FormFields';
import { CalcBlock } from './CalcBlock';

interface Props {
  value: ProjectionActiviteParams;
  scenarios: ProjectionScenario[];
  onChange: (next: ProjectionActiviteParams) => void;
}

/** Mesures cibles du cabinet libéral, une ligne par scénario (0 : association jusqu'à la retraite). */
export const MesuresCiblesFields: React.FC<Props> = ({ value, scenarios, onChange }) => (
  <CalcBlock
    title="Mesures cibles par scénario"
    hint="0 : pas de libéral, association jusqu'à la retraite"
  >
    {scenarios.map((s) => (
      <NumberField
        key={s.id}
        label={`Mesures cibles — ${s.nom || 'Sans nom'}`}
        value={value.scenarios[s.id] ?? 0}
        onChange={(v) => onChange({ ...value, scenarios: { ...value.scenarios, [s.id]: v ?? 0 } })}
      />
    ))}
  </CalcBlock>
);
