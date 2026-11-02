import React from 'react';
import type {
  ProjectionMoisReel,
  ProjectionMonth,
  ProjectionParams,
  ProjectionRapport,
} from '../../types/banking.types';
import { Stack } from '../../ui';
import { ProjectionBudgetMensuel } from './ProjectionBudgetMensuel';
import { ProjectionPhaseTable } from './ProjectionPhaseTable';
import { ProjectionYearTable } from './ProjectionYearTable';

/** Onglet « Détail » : phases, budget mensuel et années du scénario affiché. */
export const ProjectionDetail: React.FC<{
  rapport: ProjectionRapport;
  params: ProjectionParams;
  releves: Record<ProjectionMonth, ProjectionMoisReel>;
  onSaisie: (mois: ProjectionMonth, saisie: ProjectionMoisReel | undefined) => void;
}> = ({ rapport, params, releves, onSaisie }) => {
  const scenario =
    params.scenarios.find((s) => s.id === params.scenarioAfficheId) ?? params.scenarios[0];
  return (
    <Stack gap="xl">
      <ProjectionPhaseTable
        phases={rapport.phases}
        personnes={params.personnes}
        scenarioNom={scenario?.nom ?? ''}
      />
      <ProjectionBudgetMensuel
        mois={rapport.mois}
        personnes={params.personnes}
        releves={releves}
        saisies={params.moisReels ?? {}}
        onSaisie={onSaisie}
      />
      <ProjectionYearTable annees={rapport.annees} />
    </Stack>
  );
};
