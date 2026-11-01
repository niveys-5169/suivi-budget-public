import React from 'react';
import { Field, Select } from '../../../ui';
import type { ProjectionPersonne } from '../../../types/banking.types';

interface Props {
  personnes: ProjectionPersonne[];
  value: string;
  onChange: (personneId: string) => void;
}

export const PersonneSelect: React.FC<Props> = ({ personnes, value, onChange }) => (
  <Field label="Personne">
    {(p) => (
      <Select {...p} value={value} onChange={(e) => onChange(e.target.value)}>
        {personnes.map((personne) => (
          <option key={personne.id} value={personne.id}>
            {personne.prenom || 'Sans nom'}
          </option>
        ))}
      </Select>
    )}
  </Field>
);
