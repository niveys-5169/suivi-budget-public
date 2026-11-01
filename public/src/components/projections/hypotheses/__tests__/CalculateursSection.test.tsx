import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectionParams } from '../../../../types/banking.types';
import { makeCalculateursParams } from '../../../../utils/__tests__/calculateursFixtures';
import { ProjectionHypotheses } from '../ProjectionHypotheses';
import { makeParams, makeProjection } from './fixtures';

vi.mock('../../../../lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const user = userEvent.setup();

/** Affiche l'onglet, ouvre « Calculateurs » ; renvoie `save` pour inspecter l'enregistrement. */
async function setup(params: ProjectionParams, messages?: string[]) {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<ProjectionHypotheses projection={makeProjection(params, save, messages)} />);
  await user.click(screen.getByRole('button', { name: /Calculateurs/ }));
  return save;
}

const saved = async (save: ReturnType<typeof vi.fn>) => {
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
  return save.mock.calls[0]![0] as ProjectionParams;
};

const withCalc = (patch: (p: ProjectionParams) => void): ProjectionParams => {
  const params = makeCalculateursParams();
  patch(params);
  return params;
};

const typeInto = async (
  label: string,
  text: string,
  scope: Pick<typeof screen, 'getByLabelText'> = screen,
) => {
  const input = scope.getByLabelText(label);
  await user.clear(input);
  await user.type(input, text);
};

beforeEach(() => vi.clearAllMocks());

describe('Calculateurs : état vide', () => {
  it('explique et initialise des paramètres génériques inactifs', async () => {
    const save = await setup(makeParams());
    expect(screen.getByText('Aucun paramètre de calculateur')).toBeInTheDocument();
    expect(screen.getByText(/l'import les remplit/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Initialiser les paramètres' }));
    expect(
      screen.getByRole('switch', { name: 'Calculer les revenus et les retraites' }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Impôt')).toBeInTheDocument();

    const { calculateurs } = await saved(save);
    expect(calculateurs).toMatchObject({
      actif: false,
      fiscal: { ageLimiteRattachement: 21 },
      retraite: { personnes: [{ personneId: 'p1' }, { personneId: 'p2' }] },
      activite: { scenarios: { s1: 0 } },
    });
  });
});

describe('Calculateurs : interrupteur', () => {
  it('active les calculateurs à l’enregistrement', async () => {
    const save = await setup(withCalc((p) => (p.calculateurs!.actif = false)));
    const toggle = screen.getByRole('switch', { name: 'Calculer les revenus et les retraites' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect((await saved(save)).calculateurs?.actif).toBe(true);
  });

  it('affiche les messages de résolution (bloc manquant) sous forme d’alerte', async () => {
    const message = 'Calculateurs activés, mais paramètres manquants (fiscal)';
    await setup(makeCalculateursParams(), [message]);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('n’affiche pas d’alerte sans message', async () => {
    await setup(makeCalculateursParams());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Calculateurs : édition', () => {
  it('modifie un champ de chaque sous-section', async () => {
    const save = await setup(makeCalculateursParams());
    await typeInto('Âge limite de rattachement fiscal', '18');
    await typeInto('Taux PAS actuel — Alex (%)', '8,5');
    await typeInto(
      'Trimestres validés',
      '120',
      within(screen.getByRole('group', { name: 'Retraite — Alex' })),
    );
    await typeInto('Cotisations salariales (%)', '22');
    await typeInto("Net avant PAS d'un mois normal (€)", '3100');
    await typeInto('Délai de réflexion (jours)', '10');
    await typeInto('Tarif moyen par mesure (€)', '120');

    const { calculateurs: calc } = await saved(save);
    expect(calc!.fiscal).toMatchObject({
      ageLimiteRattachement: 18,
      tauxReelsActuels: { p1: 0.085, p2: 0.04 },
    });
    expect(calc!.retraite!.personnes[0]!.trimestresValides).toBe(120);
    expect(calc!.retraite!.personnes[1]!.trimestresValides).toBe(80);
    expect(calc!.activite).toMatchObject({
      paie: { netAvantPas: 3100 },
      calendrier: { delaiReflexionJours: 10 },
      ccn66: { tauxCotisationsSalariales: 0.22 },
      liberal: { tarifMesure: 120 },
    });
  });

  it('modifie une date, un interrupteur et la personne 2', async () => {
    const save = await setup(makeCalculateursParams());
    await user.click(screen.getByRole('switch', { name: 'Taux PAS individualisés' }));
    await typeInto('Date de notification', '2030-02-04');
    await typeInto('Salaire brut annuel (personne 2, €)', '31000');
    const { calculateurs: calc } = await saved(save);
    expect(calc!.fiscal!.tauxIndividualises).toBe(false);
    expect(calc!.activite!.calendrier.dateNotification).toBe('2030-02-04');
    expect(calc!.activite!.personne2!.salaireBrutAnnuel).toBe(31000);
  });

  it('une ligne de mesures cibles par scénario', async () => {
    const save = await setup(makeCalculateursParams());
    expect(screen.getByLabelText('Mesures cibles — Association')).toHaveValue('0');
    expect(screen.getByLabelText('Mesures cibles — Libéral')).toHaveValue('20');
    await typeInto('Mesures cibles — Libéral', '30');
    expect((await saved(save)).calculateurs!.activite!.scenarios).toEqual({ s1: 0, s2: 30 });
  });

  it('édite la montée en charge et la liste des charges du cabinet', async () => {
    const save = await setup(makeCalculateursParams());
    await typeInto('Part des mesures cibles, année 2 (%)', '80');
    expect(
      screen.getByLabelText('Libellé de la charge', { selector: '[value="Loyer"]' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ajouter une charge' }));
    const libelles = screen.getAllByLabelText('Libellé de la charge');
    await user.type(libelles[3]!, 'Assurance');
    await user.type(screen.getAllByLabelText('Montant de référence (€ par an)')[3]!, '500');
    await user.selectOptions(
      screen.getAllByLabelText('Nature de la charge')[3]!,
      'Variable (proportionnelle aux mesures)',
    );
    await user.click(screen.getByRole('button', { name: 'Supprimer la charge Loyer' }));

    const { liberal } = (await saved(save)).calculateurs!.activite!;
    expect(liberal.monteeEnCharge).toEqual([0.5, 0.8, 1]);
    expect(liberal.charges.map((c) => c.libelle)).toEqual(['Déplacements', 'CFE', 'Assurance']);
    expect(liberal.charges[2]).toEqual({
      libelle: 'Assurance',
      montantReference: 500,
      nature: 'variable',
    });
  });

  it('édite les salaires du relevé', async () => {
    const save = await setup(makeCalculateursParams());
    const alex = within(screen.getByRole('group', { name: 'Retraite — Alex' }));
    await typeInto('Salaire brut 2029 (€)', '47000', alex);
    await user.click(alex.getByRole('button', { name: "Ajouter l'année 2030" }));
    await user.click(alex.getByRole('button', { name: 'Supprimer le salaire 2028' }));
    const { salairesPasses } = (await saved(save)).calculateurs!.retraite!.personnes[0]!;
    expect(salairesPasses).toEqual({ '2029': 47000, '2030': 0 });
  });
});

describe('Phases : mention des revenus calculés', () => {
  it('apparaît quand les calculateurs sont actifs', async () => {
    render(<ProjectionHypotheses projection={makeProjection(makeCalculateursParams())} />);
    await user.click(screen.getByRole('button', { name: /Scénarios et revenus/ }));
    expect(
      screen.getAllByText(
        'Revenus calculés — les phases ci-dessous ne sont pas utilisées pour Alex et Sam',
      ),
    ).toHaveLength(2);
  });

  it('est absente quand ils sont inactifs', async () => {
    render(<ProjectionHypotheses projection={makeProjection(makeParams())} />);
    await user.click(screen.getByRole('button', { name: /Scénarios et revenus/ }));
    expect(screen.queryByText(/Revenus calculés/)).not.toBeInTheDocument();
  });
});
