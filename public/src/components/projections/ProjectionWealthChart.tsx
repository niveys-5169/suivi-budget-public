import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  ProjectionEvolutionAnnee,
  ProjectionSyntheseScenario,
} from '../../types/banking.types';
import { Button, Card, chartSeries, color, EmptyState, radius, Section } from '../../ui';
import { formatCompactCurrency } from '../../lib/formatters';
import { formatEuros } from './projectionFormat';
import { DataTable, Money, ROW_CLS, RowHead, Td, Th } from './ProjectionTable';

type Scenario = Pick<ProjectionSyntheseScenario, 'scenarioId' | 'nom'>;

/** Couleur de série par rang (et non par hash) : cinq scénarios, cinq couleurs distinctes. */
const seriesColor = (index: number): string =>
  chartSeries[index % chartSeries.length] ?? color.labelSecondary;

/** Patrimoine total de fin d'année, une courbe par scénario, avec tableau repliable. */
export const ProjectionWealthChart: React.FC<{
  evolution: ProjectionEvolutionAnnee[];
  scenarios: Scenario[];
}> = ({ evolution, scenarios }) => {
  const [open, setOpen] = useState(false);
  const data = useMemo(
    () => evolution.map((e) => ({ annee: e.annee, ...e.parScenario })),
    [evolution],
  );

  return (
    <Section title="Évolution du patrimoine">
      <Card className="flex flex-col gap-4">
        {data.length === 0 ? (
          <EmptyState
            title="Aucune projection à afficher"
            description="Renseignez l'horizon dans l'onglet Hypothèses."
          />
        ) : (
          <div
            className="h-80"
            role="img"
            aria-label="Patrimoine total de fin d'année par scénario"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={color.separator} vertical={false} />
                <XAxis
                  dataKey="annee"
                  tick={{ fill: color.labelTertiary, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  width={72}
                  tick={{ fill: color.labelTertiary, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCompactCurrency(Number(v))}
                />
                <Tooltip
                  formatter={(value, name) => [formatEuros(Number(value)), name]}
                  labelFormatter={(label) => `Fin ${label}`}
                  contentStyle={{
                    background: color.surface,
                    border: `1px solid ${color.separator}`,
                    borderRadius: radius.lg,
                  }}
                  labelStyle={{ color: color.labelSecondary }}
                  itemStyle={{ color: color.label }}
                />
                <Legend />
                {scenarios.map((s, i) => (
                  <Line
                    key={s.scenarioId}
                    type="monotone"
                    dataKey={s.scenarioId}
                    name={s.nom}
                    stroke={seriesColor(i)}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.length > 0 && (
          <>
            <Button
              variant="plain"
              size="sm"
              className="self-start"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Masquer les valeurs annuelles' : 'Afficher les valeurs annuelles'}
            </Button>
            {open && (
              <DataTable label="Patrimoine total de fin d'année par scénario">
                <thead>
                  <tr>
                    <Th align="left">Année</Th>
                    {scenarios.map((s) => (
                      <Th key={s.scenarioId}>{s.nom}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evolution.map((e) => (
                    <tr key={e.annee} className={ROW_CLS}>
                      <RowHead>{e.annee}</RowHead>
                      {scenarios.map((s) => (
                        <Td key={s.scenarioId}>
                          <Money value={e.parScenario[s.scenarioId] ?? null} tone="auto" />
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </>
        )}
      </Card>
    </Section>
  );
};
