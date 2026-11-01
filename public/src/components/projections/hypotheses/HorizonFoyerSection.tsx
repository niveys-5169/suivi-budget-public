import React from 'react';
import type { ProjectionParams } from '../../../types/banking.types';
import type { SectionProps } from './editorTypes';
import { EnfantsEditor, PersonnesEditor } from './FoyerEditors';
import { DateField, NumberField } from './FormFields';

export const HorizonFoyerSection: React.FC<SectionProps> = (props) => {
  const { draft, onChange } = props;
  const { horizon } = draft;
  const setHorizon = (patch: Partial<ProjectionParams['horizon']>) =>
    onChange({ ...draft, horizon: { ...horizon, ...patch } });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DateField
          kind="month"
          label="Début"
          value={horizon.debut}
          onChange={(debut) => setHorizon({ debut })}
        />
        <DateField
          kind="month"
          label="Fin"
          value={horizon.fin}
          onChange={(fin) => setHorizon({ fin })}
        />
        <NumberField
          label="Année de référence des prix"
          value={horizon.anneeReferencePrix}
          onChange={(v) => setHorizon({ anneeReferencePrix: v ?? horizon.anneeReferencePrix })}
        />
      </div>
      <PersonnesEditor {...props} />
      <EnfantsEditor {...props} />
    </>
  );
};
