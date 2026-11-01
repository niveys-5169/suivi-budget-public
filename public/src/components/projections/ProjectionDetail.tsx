import React from 'react';
import type { ProjectionParams, ProjectionRapport } from '../../types/banking.types';
import { Stack } from '../../ui';
import { ProjectionPhaseTable } from './ProjectionPhaseTable';
import { ProjectionYearTable } from './ProjectionYearTable';

/** Onglet « Détail » : phases et années du scénario affiché. */
export const ProjectionDetail: React.FC<{
  rapport: ProjectionRapport;
  params: ProjectionParams;
}> = ({ rapport, params }) => {
  const scenario =
    params.scenarios.find((s) => s.id === params.scenarioAfficheId) ?? params.scenarios[0];
  return (
    <Stack gap="xl">
      <ProjectionPhaseTable
        phases={rapport.phases}
        personnes={params.personnes}
        scenarioNom={scenario?.nom ?? ''}
      />
      <ProjectionYearTable annees={rapport.annees} />
    </Stack>
  );
};
