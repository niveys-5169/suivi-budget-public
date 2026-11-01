import React from 'react';
import type { ProjectionAnneeDetail } from '../../types/banking.types';
import { Card, EmptyState, Section, Text } from '../../ui';
import { DataTable, Money, ROW_CLS, RowHead, Td, Th } from './ProjectionTable';

type FluxKey = Exclude<keyof ProjectionAnneeDetail, 'annee' | 'phaseDecembre' | 'patrimoineFin'>;

const FLUX: { key: FluxKey; label: string; tone?: 'auto' }[] = [
  { key: 'revenus', label: 'Revenus' },
  { key: 'depenses', label: 'Dépenses' },
  { key: 'capacite', label: 'Capacité', tone: 'auto' },
  { key: 'depensesExceptionnelles', label: 'Dépenses exceptionnelles' },
  { key: 'encaissements', label: 'Encaissements' },
  { key: 'remboursementsAnticipes', label: 'Remboursements anticipés' },
  { key: 'rendements', label: 'Rendements' },
  { key: 'abondement', label: 'Abondement' },
  { key: 'variationPatrimoine', label: 'Variation', tone: 'auto' },
];

/** Flux annuels (sommes) du scénario affiché, avec une ligne de total. */
export const ProjectionYearTable: React.FC<{ annees: ProjectionAnneeDetail[] }> = ({ annees }) => {
  const total = (key: FluxKey) => annees.reduce((sum, a) => sum + a[key], 0);

  return (
    <Section title="Détail par année">
      <Card padding="none">
        {annees.length === 0 ? (
          <EmptyState title="Aucune année" description="L'horizon de projection est vide." />
        ) : (
          <DataTable label="Flux annuels du scénario affiché">
            <thead>
              <tr>
                <Th align="left">Année · phase</Th>
                {FLUX.map((f) => (
                  <Th key={f.key}>{f.label}</Th>
                ))}
                <Th>Patrimoine fin d&apos;année</Th>
              </tr>
            </thead>
            <tbody>
              {annees.map((a) => (
                <tr key={a.annee} className={ROW_CLS}>
                  <RowHead>
                    {a.annee} · {a.phaseDecembre}
                  </RowHead>
                  {FLUX.map((f) => (
                    <Td key={f.key}>
                      <Money value={a[f.key]} tone={f.tone} />
                    </Td>
                  ))}
                  <Td>
                    <Money value={a.patrimoineFin} tone="auto" />
                  </Td>
                </tr>
              ))}
              <tr className={`${ROW_CLS} bg-raised`}>
                <RowHead strong>Total</RowHead>
                {FLUX.map((f) => (
                  <Td key={f.key}>
                    <Money value={total(f.key)} tone={f.tone} strong />
                  </Td>
                ))}
                <Td>
                  <Text as="span" variant="callout" tone="tertiary">
                    —
                  </Text>
                </Td>
              </tr>
            </tbody>
          </DataTable>
        )}
      </Card>
      <Text variant="footnote" tone="tertiary" className="px-1">
        Montants en € courants ; la phase est celle de décembre.
      </Text>
    </Section>
  );
};
