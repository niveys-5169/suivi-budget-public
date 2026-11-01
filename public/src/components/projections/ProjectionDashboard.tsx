import React from 'react';
import type { ProjectionParams, ProjectionRapport } from '../../types/banking.types';
import { Stack } from '../../ui';
import { ProjectionChecks } from './ProjectionChecks';
import { ProjectionRetirementTable } from './ProjectionRetirementTable';
import { ProjectionWealthChart } from './ProjectionWealthChart';
import { ProjectionWealthKpis } from './ProjectionWealthKpis';

/** Onglet « Tableau de bord » : comparaison des scénarios. */
export const ProjectionDashboard: React.FC<{
  rapport: ProjectionRapport;
  params: ProjectionParams;
}> = ({ rapport, params }) => {
  const anneeReference = params.horizon.anneeReferencePrix;
  return (
    <Stack gap="xl">
      <ProjectionWealthKpis
        synthese={rapport.synthese}
        personnes={params.personnes}
        anneeReference={anneeReference}
      />
      <ProjectionRetirementTable retraite={rapport.retraite} anneeReference={anneeReference} />
      <ProjectionWealthChart evolution={rapport.evolution} scenarios={rapport.synthese} />
      <ProjectionChecks controles={rapport.controles} pointsAConfirmer={rapport.pointsAConfirmer} />
    </Stack>
  );
};
