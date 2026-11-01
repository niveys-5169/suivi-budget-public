import React, { useState } from 'react';
import { useProjection } from '../../hooks/useProjection';
import { Card, EmptyState, Screen, SegmentedControl, Skeleton, Stack, Text } from '../../ui';
import type { Segment } from '../../ui';
import { ProjectionDashboard } from './ProjectionDashboard';
import { ProjectionDetail } from './ProjectionDetail';
import { ProjectionHypotheses } from './hypotheses/ProjectionHypotheses';
import { formatMois } from './projectionFormat';

type Tab = 'dashboard' | 'hypotheses' | 'detail';

const TABS: readonly Segment<Tab>[] = [
  { value: 'dashboard', label: 'Tableau de bord' },
  { value: 'hypotheses', label: 'Hypothèses' },
  { value: 'detail', label: 'Détail' },
];

/** Section « Projections » (desktop) : tableau de bord, hypothèses et détail du scénario affiché. */
export const ProjectionsSection: React.FC = () => {
  const projection = useProjection();
  const { params, exists, save, rapport, loading, error } = projection;
  const [tab, setTab] = useState<Tab>('dashboard');
  const [saveError, setSaveError] = useState<string | null>(null);

  const subtitle = `Horizon ${formatMois(params.horizon.debut)} → ${formatMois(params.horizon.fin)} · € courants`;
  const scenarioSegments = params.scenarios.map((s) => ({ value: s.id, label: s.nom }));
  const displayed = scenarioSegments.find((s) => s.value === params.scenarioAfficheId)
    ? params.scenarioAfficheId
    : (scenarioSegments[0]?.value ?? '');

  const changeScenario = (scenarioAfficheId: string) => {
    setSaveError(null);
    save({ ...params, scenarioAfficheId }).catch(() =>
      setSaveError("Le scénario n'a pas pu être enregistré. Réessayez."),
    );
  };

  let content: React.ReactNode;
  if (error) {
    content = (
      <EmptyState title="Impossible de charger les projections" description={String(error)} />
    );
  } else if (loading) {
    content = (
      <Stack gap="md" aria-busy="true" aria-label="Chargement des projections">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </Stack>
    );
  } else if (tab === 'hypotheses') {
    content = <ProjectionHypotheses projection={projection} />;
  } else if (tab === 'detail') {
    content = <ProjectionDetail rapport={rapport} params={params} />;
  } else {
    content = <ProjectionDashboard rapport={rapport} params={params} />;
  }

  return (
    <Screen title="Projections" subtitle={subtitle} width="full">
      {!loading && !error && !exists && (
        <Card bordered>
          <Text variant="subhead" tone="warning">
            Paramètres par défaut — renseignez les hypothèses ou importez votre classeur
          </Text>
        </Card>
      )}
      {saveError && (
        <Text variant="subhead" tone="negative" role="alert">
          {saveError}
        </Text>
      )}
      <Stack direction="row" gap="md" align="center" justify="between" wrap>
        <SegmentedControl
          segments={TABS}
          value={tab}
          onChange={setTab}
          label="Vue des projections"
        />
        {scenarioSegments.length > 1 && (
          <Stack direction="row" gap="sm" align="center">
            <Text variant="footnote" tone="secondary">
              Scénario détaillé
            </Text>
            <SegmentedControl
              segments={scenarioSegments}
              value={displayed}
              onChange={changeScenario}
              label="Scénario détaillé"
            />
          </Stack>
        )}
      </Stack>
      {content}
    </Screen>
  );
};
