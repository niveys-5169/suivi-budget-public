import React from 'react';
import type { ProjectionRetraiteScenario } from '../../types/banking.types';
import { Card, Section, Text } from '../../ui';
import { formatPercent } from '../../lib/formatters';
import { Money, ScenarioMatrix } from './ProjectionTable';

type Retraite = ProjectionRetraiteScenario;

/** Section « Retraite » : pensions nettes mensuelles par personne et pour le foyer. */
export const ProjectionRetirementTable: React.FC<{
  retraite: Retraite[];
  anneeReference: number;
}> = ({ retraite, anneeReference }) => {
  const personnes = retraite[0]?.parPersonne ?? [];
  const pension = (s: Retraite, personneId: string) =>
    s.parPersonne.find((p) => p.personneId === personneId);

  const rows = [
    ...personnes.flatMap((p) => [
      {
        id: `${p.personneId}-avant`,
        label: `${p.prenom}, net avant impôt`,
        cell: (s: Retraite) => <Money value={pension(s, p.personneId)?.netAvantImpot ?? 0} />,
      },
      {
        id: `${p.personneId}-apres`,
        label: `${p.prenom}, net après impôt`,
        cell: (s: Retraite) => <Money value={pension(s, p.personneId)?.netApresImpot ?? 0} />,
      },
    ]),
    {
      id: 'foyer-avant',
      label: 'Foyer, net avant impôt',
      cell: (s: Retraite) => <Money value={s.totalAvantImpot} strong />,
    },
    {
      id: 'foyer-apres',
      label: 'Foyer, net après impôt',
      cell: (s: Retraite) => <Money value={s.totalApresImpot} strong />,
    },
    {
      id: 'remplacement',
      label: 'Taux de remplacement',
      cell: (s: Retraite) => (
        <Text as="span" variant="callout" numeric>
          {s.tauxRemplacement === null ? '—' : formatPercent(s.tauxRemplacement * 100)}
        </Text>
      ),
    },
  ];

  return (
    <Section title="Retraite">
      <Card padding="none">
        <ScenarioMatrix
          label="Pensions de retraite par scénario"
          scenarios={retraite}
          rows={rows}
        />
      </Card>
      <Text variant="footnote" tone="tertiary" className="px-1">
        Pensions mensuelles nettes, en € {anneeReference}.
      </Text>
    </Section>
  );
};
