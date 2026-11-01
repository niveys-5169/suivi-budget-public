import type { ProjectionInputs, ProjectionParams } from '../../../types/banking.types';
import { blocsManquants, computeScenarioCalcule } from './computeScenarioCalcule';

/**
 * Branche les calculateurs sur les entrées du moteur : si `calculateurs.actif`, les revenus de chaque
 * scénario viennent de `computeScenarioCalcule` (« Auto (calculé) »). Un bloc manquant n'empêche pas la
 * résolution : les phases et pensions saisies restent utilisées et un message l'indique.
 */
export function applyCalculateurs(
  params: ProjectionParams,
  inputs: ProjectionInputs,
): ProjectionInputs {
  if (!params.calculateurs?.actif) return inputs;
  const manque = blocsManquants(params);
  if (manque.length > 0)
    return {
      ...inputs,
      messagesCalculateurs: [
        `Calculateurs activés, mais paramètres manquants (${manque.join(', ')}) : les revenus restent ceux des phases et pensions saisies.`,
      ],
    };
  const messages: string[] = [];
  const scenarios = inputs.scenarios.map((scenario) => {
    if (!(scenario.id in params.calculateurs!.activite!.scenarios))
      messages.push(
        `Scénario « ${scenario.nom} » : mesures cibles non renseignées, association supposée.`,
      );
    const calcule = computeScenarioCalcule(params, scenario.id, inputs.horizon);
    if (!calcule) return scenario;
    const { fiscal: _fiscal, ...revenus } = calcule;
    return { ...scenario, ...revenus };
  });
  return {
    ...inputs,
    scenarios,
    ...(messages.length > 0 ? { messagesCalculateurs: messages } : {}),
  };
}
