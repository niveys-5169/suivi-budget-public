import type {
  ProjectionInputs,
  ProjectionPension,
  ProjectionPhaseResolue,
} from '../../types/banking.types';

/** Entrées synthétiques : horizon 2026, sans inflation ni rendement, deux personnes, un scénario vide. */
export function makeInputs(over: Partial<ProjectionInputs> = {}): ProjectionInputs {
  return {
    horizon: { debut: '2026-01', fin: '2026-03', anneeReferencePrix: 2026 },
    macro: { inflation: 0, rendementCapital: 0, rendementPatrimoine: 0 },
    personnes: [
      { id: 'a', prenom: 'Alice' },
      { id: 'b', prenom: 'Bruno' },
    ],
    phasesCommunes: [],
    pensionsCommunes: [],
    caf: { montant: 0, evolutionAnnuelle: 0 },
    budgetReference: 0,
    credits: [],
    exceptionnelles: [],
    capitalInitial: 0,
    encaissements: [],
    patrimoineDepart: 0,
    scenarios: [{ id: 's1', nom: 'Scénario 1', phases: [], pensions: [] }],
    ...over,
  };
}

export function makePhase(
  personneId: string,
  netMensuel: number,
  debut: string,
  over: Partial<ProjectionPhaseResolue> = {},
): ProjectionPhaseResolue {
  return {
    id: `${personneId}-${debut}`,
    personneId,
    libelle: 'Activité',
    debut,
    netMensuel,
    revalorisationAnnuelle: 0,
    ...over,
  };
}

export function makePension(
  personneId: string,
  netApresImpot: number,
  debut: string,
  netAvantImpot = netApresImpot,
): ProjectionPension {
  return { id: `pension-${personneId}-${debut}`, personneId, debut, netAvantImpot, netApresImpot };
}
