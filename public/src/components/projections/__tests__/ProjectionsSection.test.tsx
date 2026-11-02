import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { ProjectionsSection } from '../ProjectionsSection';
import { createDefaultProjectionParams } from '../../../utils/projection/defaults';
import { simulateAll } from '../../../utils/projection/simulateProjection';
import { buildProjectionReport } from '../../../utils/projection/projectionReport';
import { makeInputs, makePension, makePhase } from '../../../utils/__tests__/projectionFixtures';
import type { ProjectionParams, ProjectionRapport } from '../../../types/banking.types';

const m = vi.hoisted(() => ({ projection: null as unknown }));

vi.mock('../../../hooks/useProjection', () => ({ useProjection: () => m.projection }));
vi.mock('../hypotheses/ProjectionHypotheses', () => ({
  ProjectionHypotheses: () => <div>Formulaire des hypothèses</div>,
}));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="line-chart" data-points={data.length}>
      {children}
    </div>
  ),
  Line: ({ name }: { name: string }) => <span data-testid="line-series">{name}</span>,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
}));

function buildProjection(over: Record<string, unknown> = {}, rapport?: Partial<ProjectionRapport>) {
  const inputs = makeInputs({
    horizon: { debut: '2026-01', fin: '2029-12', anneeReferencePrix: 2026 },
    budgetReference: 2500,
    capitalInitial: 10000,
    patrimoineDepart: 50000,
    caf: { montant: 100, evolutionAnnuelle: 0 },
    scenarios: [
      {
        id: 's1',
        nom: 'Scénario prudent',
        phases: [makePhase('a', 2000, '2026-01'), makePhase('b', 1500, '2026-01')],
        pensions: [makePension('a', 1200, '2028-01', 1400)],
      },
      {
        id: 's2',
        nom: 'Scénario offensif',
        phases: [makePhase('a', 2600, '2026-01'), makePhase('b', 1500, '2026-01')],
        pensions: [makePension('a', 1500, '2028-01', 1700)],
      },
    ],
  });
  const base = createDefaultProjectionParams(new Date(2026, 0, 1));
  const params: ProjectionParams = {
    ...base,
    personnes: [
      { id: 'a', prenom: 'Alice' },
      { id: 'b', prenom: 'Bruno' },
    ],
    scenarios: inputs.scenarios.map((s) => ({ ...s, phases: [] })),
    scenarioAfficheId: 's1',
    horizon: inputs.horizon,
  };
  const resultats = simulateAll(inputs);
  return {
    params,
    exists: true,
    save: vi.fn().mockResolvedValue(undefined),
    rapport: {
      ...buildProjectionReport(inputs, resultats, 's1', [
        { id: 'c1', libelle: 'Montant de la prime', commentaire: 'À vérifier auprès de la caisse' },
      ]),
      ...rapport,
    },
    releves: { '2026-01': { revenusParPersonne: { a: 2100, b: 1500 }, caf: 100, depenses: 2400 } },
    loading: false,
    error: null,
    ...over,
  };
}

describe('ProjectionsSection', () => {
  beforeEach(() => {
    m.projection = buildProjection();
  });

  it("affiche le titre, l'horizon et les trois onglets", () => {
    render(<ProjectionsSection />);
    expect(screen.getByRole('heading', { name: 'Projections' })).toBeInTheDocument();
    expect(screen.getByText(/Horizon .*2026 → .*2029 · € courants/)).toBeInTheDocument();
    for (const name of ['Tableau de bord', 'Hypothèses', 'Détail']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('tableau de bord : indicateurs par scénario, retraite, graphique et points à confirmer', () => {
    render(<ProjectionsSection />);
    const kpis = screen.getByRole('table', { name: 'Patrimoine et budget par scénario' });
    expect(
      within(kpis).getByRole('columnheader', { name: 'Scénario prudent' }),
    ).toBeInTheDocument();
    expect(
      within(kpis).getByRole('columnheader', { name: 'Scénario offensif' }),
    ).toBeInTheDocument();
    expect(within(kpis).getByText('Revenus de Alice')).toBeInTheDocument();
    expect(within(kpis).getByText('Revenus de Bruno')).toBeInTheDocument();
    expect(within(kpis).getByText('Épuisement du capital')).toBeInTheDocument();

    const retraite = screen.getByRole('table', { name: 'Pensions de retraite par scénario' });
    expect(within(retraite).getByText('Alice, net après impôt')).toBeInTheDocument();
    expect(within(retraite).getByText('Taux de remplacement')).toBeInTheDocument();

    expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points', '4');
    expect(screen.getAllByTestId('line-series').map((n) => n.textContent)).toEqual([
      'Scénario prudent',
      'Scénario offensif',
    ]);

    expect(screen.getByText('Points à confirmer')).toBeInTheDocument();
    expect(screen.getByText('À vérifier auprès de la caisse')).toBeInTheDocument();
  });

  it('replie le tableau des valeurs annuelles par défaut', () => {
    render(<ProjectionsSection />);
    expect(screen.queryByRole('table', { name: /fin d'année par scénario/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Afficher les valeurs annuelles' }));
    const table = screen.getByRole('table', { name: /fin d'année par scénario/ });
    expect(within(table).getByText('2029')).toBeInTheDocument();
  });

  it("affiche l'onglet Hypothèses", () => {
    render(<ProjectionsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Hypothèses' }));
    expect(screen.getByText('Formulaire des hypothèses')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Patrimoine et budget par scénario' })).toBeNull();
  });

  it('onglet Détail : phases et années avec ligne de total', () => {
    render(<ProjectionsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Détail' }));
    expect(screen.getByText('Phases du scénario « Scénario prudent »')).toBeInTheDocument();
    const phases = screen.getByRole('table', { name: 'Moyennes mensuelles par phase' });
    expect(
      within(phases).getByRole('columnheader', { name: 'Revenus de Alice' }),
    ).toBeInTheDocument();
    const annees = screen.getByRole('table', { name: 'Flux annuels du scénario affiché' });
    expect(within(annees).getByText('Total')).toBeInTheDocument();
    expect(within(annees).getByText(/^2026 · /)).toBeInTheDocument();
    expect(within(annees).getByText(/^2029 · /)).toBeInTheDocument();
  });

  it('onglet Détail : budget mensuel regroupé par période, mois par mois et colonnes détaillées', () => {
    render(<ProjectionsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Détail' }));
    const budget = () => screen.getByRole('table', { name: 'Budget mensuel du foyer' });
    const nbLignes = () => within(budget()).getAllByRole('row').length - 1;

    expect(within(budget()).getByRole('columnheader', { name: 'Alice' })).toBeInTheDocument();
    expect(within(budget()).queryByRole('columnheader', { name: 'Crédits' })).toBeNull();
    const periodes = nbLignes();
    expect(periodes).toBeGreaterThan(0);
    expect(periodes).toBeLessThan(48);

    fireEvent.click(screen.getByRole('button', { name: 'Mois par mois' }));
    expect(nbLignes()).toBe(48);

    fireEvent.click(screen.getByRole('switch', { name: 'Colonnes détaillées' }));
    expect(within(budget()).getByRole('columnheader', { name: 'Crédits' })).toBeInTheDocument();
    expect(within(budget()).getByRole('columnheader', { name: 'Rendements' })).toBeInTheDocument();
  });

  it('budget mensuel : saisie manuelle d un mois enregistrée dans moisReels', () => {
    const projection = buildProjection();
    m.projection = projection;
    render(<ProjectionsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Détail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mois par mois' }));
    fireEvent.click(screen.getByRole('button', { name: /^Modifier janv.* 2026$/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Vide : montant relevé (2 400 €)')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Dépenses'), { target: { value: '2600,5' } });
    // Le mock global de framer-motion remonte la modale à chaque rendu : on la relit.
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Enregistrer' }),
    );
    expect(projection.save).toHaveBeenCalledWith({
      ...projection.params,
      moisReels: { '2026-01': { depenses: 2600.5 } },
    });
  });

  it('budget mensuel : effacer la saisie retire le mois de moisReels', () => {
    const projection = buildProjection();
    projection.params = { ...projection.params, moisReels: { '2026-01': { caf: 0 } } };
    m.projection = projection;
    render(<ProjectionsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Détail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mois par mois' }));
    fireEvent.click(screen.getByRole('button', { name: /^Modifier janv.* 2026$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la saisie' }));
    expect(projection.save).toHaveBeenCalledWith({ ...projection.params, moisReels: {} });
  });

  it('bandeau d information quand aucun paramètre n est enregistré', () => {
    m.projection = buildProjection({ exists: false });
    render(<ProjectionsSection />);
    expect(
      screen.getByText(
        'Paramètres par défaut — renseignez les hypothèses ou importez votre classeur',
      ),
    ).toBeInTheDocument();
  });

  it('pas de bandeau quand les paramètres existent', () => {
    render(<ProjectionsSection />);
    expect(screen.queryByText(/Paramètres par défaut/)).toBeNull();
  });

  it('changer de scénario détaillé enregistre scenarioAfficheId', () => {
    const projection = buildProjection();
    m.projection = projection;
    render(<ProjectionsSection />);
    const group = screen.getByRole('group', { name: 'Scénario détaillé' });
    fireEvent.click(within(group).getByRole('button', { name: 'Scénario offensif' }));
    expect(projection.save).toHaveBeenCalledWith({ ...projection.params, scenarioAfficheId: 's2' });
  });

  it('affiche un contrôle en échec', () => {
    m.projection = buildProjection(
      {},
      {
        controles: [
          { id: 'ok', libelle: 'Capital jamais négatif', ok: true },
          { id: 'ko', libelle: 'Patrimoine cohérent avec la somme des flux', ok: false },
        ],
      },
    );
    render(<ProjectionsSection />);
    const ko = screen.getByText('Patrimoine cohérent avec la somme des flux').closest('li');
    expect(ko).not.toBeNull();
    expect(within(ko as HTMLElement).getByText('En échec')).toBeInTheDocument();
    const ok = screen.getByText('Capital jamais négatif').closest('li');
    expect(within(ok as HTMLElement).getByText('Conforme')).toBeInTheDocument();
  });

  it('état de chargement', () => {
    m.projection = buildProjection({ loading: true });
    render(<ProjectionsSection />);
    expect(screen.getByLabelText('Chargement des projections')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it("état d'erreur", () => {
    m.projection = buildProjection({ error: 'Permission refusée' });
    render(<ProjectionsSection />);
    expect(screen.getByText('Impossible de charger les projections')).toBeInTheDocument();
    expect(screen.getByText('Permission refusée')).toBeInTheDocument();
  });
});
