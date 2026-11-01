import React from 'react';
import type { ProjectionPersonne, ProjectionSyntheseScenario } from '../../types/banking.types';
import { Card, Section, Text } from '../../ui';
import { formatMois } from './projectionFormat';
import { Money, ScenarioMatrix } from './ProjectionTable';

type Synthese = ProjectionSyntheseScenario;

interface Props {
  synthese: Synthese[];
  personnes: ProjectionPersonne[];
  anneeReference: number;
}

/** Section « Patrimoine et budget » : un indicateur par ligne, un scénario par colonne. */
export const ProjectionWealthKpis: React.FC<Props> = ({ synthese, personnes, anneeReference }) => {
  const money = (value: number, tone: 'auto' | 'neutral' = 'neutral') => (
    <Money value={value} tone={tone} />
  );

  const rows = [
    {
      id: 'final',
      label: 'Patrimoine final (€ courants)',
      cell: (s: Synthese) => money(s.patrimoineFinal, 'auto'),
    },
    {
      id: 'reel',
      label: `Patrimoine final (€ ${anneeReference})`,
      cell: (s: Synthese) => money(s.patrimoineFinalReel, 'auto'),
    },
    { id: 'capital', label: 'dont capital', cell: (s: Synthese) => money(s.capitalFinal, 'auto') },
    { id: 'horsper', label: 'dont hors PER', cell: (s: Synthese) => money(s.horsPerFinal, 'auto') },
    {
      id: 'epuisement',
      label: 'Épuisement du capital',
      cell: (s: Synthese) => (
        <Text as="span" variant="callout" numeric>
          {s.moisEpuisementCapital ? formatMois(s.moisEpuisementCapital) : 'Jamais'}
        </Text>
      ),
    },
    {
      id: 'prelevement',
      label: 'Prélèvement cumulé sur le patrimoine',
      cell: (s: Synthese) => money(s.prelevementCumule),
    },
    {
      id: 'deficit',
      label: 'Mois en déficit',
      cell: (s: Synthese) => (
        <Text as="span" variant="callout" numeric>
          {s.moisDeficit}
        </Text>
      ),
    },
    { id: 'moyennes', label: 'Moyennes mensuelles' },
    ...personnes.map((p) => ({
      id: `revenus-${p.id}`,
      label: `Revenus de ${p.prenom}`,
      cell: (s: Synthese) => money(s.revenusParPersonne[p.id] ?? 0),
    })),
    { id: 'revenus', label: 'Revenus du foyer', cell: (s: Synthese) => money(s.revenus) },
    { id: 'depenses', label: 'Dépenses', cell: (s: Synthese) => money(s.depenses) },
    {
      id: 'capacite',
      label: "Capacité d'épargne",
      cell: (s: Synthese) => money(s.capacite, 'auto'),
    },
    {
      id: 'epargne',
      label: 'Épargne cumulée',
      cell: (s: Synthese) => money(s.epargneCumulee, 'auto'),
    },
  ];

  return (
    <Section title="Patrimoine et budget">
      <Card padding="none">
        <ScenarioMatrix
          label="Patrimoine et budget par scénario"
          scenarios={synthese}
          rows={rows}
        />
      </Card>
    </Section>
  );
};
