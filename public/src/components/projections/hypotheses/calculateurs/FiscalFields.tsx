import React from 'react';
import { SegmentedControl, Stack, Text } from '../../../../ui';
import type { Segment } from '../../../../ui';
import type { ProjectionFiscalParams, ProjectionPersonne } from '../../../../types/banking.types';
import { NumberField } from '../FormFields';
import { CalcBlock } from './CalcBlock';
import { SwitchField } from './CalcFields';
import { patchOf } from './calcUtils';

const INDEXATION: readonly Segment<ProjectionFiscalParams['indexationBareme']['mode']>[] = [
  { value: 'inflation', label: 'Inflation' },
  { value: 'manuel', label: 'Taux saisi' },
];

interface Props {
  value: ProjectionFiscalParams;
  personnes: ProjectionPersonne[];
  onChange: (next: ProjectionFiscalParams) => void;
}

/** Paramètres du calculateur fiscal : barème de l'impôt, rattachement des enfants et taux de PAS. */
export const FiscalFields: React.FC<Props> = ({ value, personnes, onChange }) => {
  const setIndexation = patchOf(value, 'indexationBareme', onChange);
  const setTaux = patchOf(value, 'tauxReelsActuels', onChange);
  const nom = (i: number) => personnes[i]?.prenom || `Personne ${i + 1}`;

  return (
    <>
      <CalcBlock title="Barème et foyer">
        <Stack gap="sm">
          <Text variant="footnote" tone="secondary">
            Indexation annuelle du barème
          </Text>
          <SegmentedControl
            label="Indexation annuelle du barème"
            segments={INDEXATION}
            value={value.indexationBareme.mode}
            onChange={(mode) => setIndexation({ mode })}
          />
        </Stack>
        {value.indexationBareme.mode === 'manuel' && (
          <NumberField
            label="Taux d'indexation du barème"
            percent
            optional
            value={value.indexationBareme.manuel}
            onChange={(manuel) => setIndexation({ manuel })}
          />
        )}
        <NumberField
          label="Âge limite de rattachement fiscal"
          hint="Un enfant plus jeune au 1er janvier compte pour une demi-part"
          value={value.ageLimiteRattachement}
          onChange={(v) => onChange({ ...value, ageLimiteRattachement: v ?? 0 })}
        />
      </CalcBlock>
      <CalcBlock title="Prélèvement à la source (PAS)">
        <NumberField
          label="Première année recalculée"
          hint="Avant : taux réels saisis ci-dessous ; à partir de cette année : taux recalculés"
          value={value.premiereAnneeRecalculee}
          onChange={(v) => onChange({ ...value, premiereAnneeRecalculee: v ?? 0 })}
        />
        <NumberField
          label={`Taux PAS actuel — ${nom(0)}`}
          percent
          value={value.tauxReelsActuels.p1}
          onChange={(p1) => setTaux({ p1: p1 ?? 0 })}
        />
        <NumberField
          label={`Taux PAS actuel — ${nom(1)}`}
          percent
          value={value.tauxReelsActuels.p2}
          onChange={(p2) => setTaux({ p2: p2 ?? 0 })}
        />
        <SwitchField
          label="Taux PAS individualisés"
          hint="Désactivé : un taux commun s'applique au foyer"
          checked={value.tauxIndividualises}
          onChange={(tauxIndividualises) => onChange({ ...value, tauxIndividualises })}
        />
        <SwitchField
          label="IR du libéral au taux PAS recalculé"
          hint="Désactivé : impôt imputé selon l'onglet du cabinet"
          checked={value.irLiberalParTaux ?? true}
          onChange={(irLiberalParTaux) => onChange({ ...value, irLiberalParTaux })}
        />
      </CalcBlock>
    </>
  );
};
