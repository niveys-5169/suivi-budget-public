import React from 'react';
import type { ProjectionPersonne, ProjectionPhaseMoyenne } from '../../types/banking.types';
import { Card, EmptyState, Section, Text } from '../../ui';
import { DataTable, Money, ROW_CLS, RowHead, Td, Th } from './ProjectionTable';

/** Moyennes mensuelles par phase du scénario affiché. */
export const ProjectionPhaseTable: React.FC<{
  phases: ProjectionPhaseMoyenne[];
  personnes: ProjectionPersonne[];
  scenarioNom: string;
}> = ({ phases, personnes, scenarioNom }) => (
  <Section title={`Phases du scénario « ${scenarioNom} »`}>
    <Card padding="none">
      {phases.length === 0 ? (
        <EmptyState title="Aucune phase" description="L'horizon de projection est vide." />
      ) : (
        <DataTable dense label="Moyennes mensuelles par phase">
          <thead>
            <tr>
              <Th align="left">Phase</Th>
              <Th>Mois</Th>
              {personnes.map((p) => (
                <Th key={p.id}>Revenus de {p.prenom}</Th>
              ))}
              <Th>CAF</Th>
              <Th>Revenus du foyer</Th>
              <Th>Dépenses</Th>
              <Th>Capacité</Th>
            </tr>
          </thead>
          <tbody>
            {phases.map((ph) => (
              <tr key={ph.phase} className={ROW_CLS}>
                <RowHead strong>{ph.phase}</RowHead>
                <Td>
                  <Text as="span" variant="callout" numeric>
                    {ph.nbMois}
                  </Text>
                </Td>
                {personnes.map((p) => (
                  <Td key={p.id}>
                    <Money value={ph.revenusParPersonne[p.id] ?? 0} />
                  </Td>
                ))}
                <Td>
                  <Money value={ph.caf} />
                </Td>
                <Td>
                  <Money value={ph.revenus} />
                </Td>
                <Td>
                  <Money value={ph.depenses} />
                </Td>
                <Td>
                  <Money value={ph.capacite} tone="auto" />
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
    <Text variant="footnote" tone="tertiary" className="px-1">
      Moyennes mensuelles sur la durée de chaque phase, en € courants.
    </Text>
  </Section>
);
