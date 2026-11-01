import React from 'react';
import type { ProjectionRetraiteScenario } from '../../types/banking.types';
import { Text } from '../../ui';
import { Money } from './ProjectionTable';

type Retraite = ProjectionRetraiteScenario;

export interface DetailRow {
  id: string;
  label: string;
  cell?: (scenario: Retraite) => React.ReactNode;
}

const REGIMES = [
  { key: 'cnav', label: 'CNAV' },
  { key: 'agircArrco', label: 'Agirc-Arrco' },
  { key: 'cipav', label: 'Cipav' },
  { key: 'per', label: 'PER' },
] as const;

/**
 * Lignes « détail par régime » (pension brute mensuelle) des personnes dont la retraite est calculée.
 * Vide si aucun scénario ne porte de détail (pensions saisies).
 */
export function retirementDetailRows(retraite: Retraite[]): DetailRow[] {
  const detail = (s: Retraite, personneId: string) =>
    s.parPersonne.find((p) => p.personneId === personneId)?.detail;
  const personnes = (retraite[0]?.parPersonne ?? []).filter((p) =>
    retraite.some((s) => detail(s, p.personneId)),
  );

  return personnes.flatMap((p) => [
    { id: `${p.personneId}-detail`, label: `${p.prenom}, détail par régime (brut mensuel)` },
    ...REGIMES.map(({ key, label }) => ({
      id: `${p.personneId}-${key}`,
      label: `${p.prenom}, ${label}`,
      cell: (s: Retraite) => <Money value={detail(s, p.personneId)?.detailBrut[key] ?? null} />,
    })),
    {
      id: `${p.personneId}-brut`,
      label: `${p.prenom}, total brut`,
      cell: (s: Retraite) => <Money value={detail(s, p.personneId)?.totalBrut ?? null} strong />,
    },
    {
      id: `${p.personneId}-trimestres`,
      label: `${p.prenom}, trimestres à la liquidation`,
      cell: (s: Retraite) => {
        const trimestres = detail(s, p.personneId)?.trimestres.total;
        return (
          <Text as="span" variant="callout" numeric>
            {trimestres === undefined ? '—' : trimestres}
          </Text>
        );
      },
    },
  ]);
}
