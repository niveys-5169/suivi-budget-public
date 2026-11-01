import type { ProjectionParams, ProjectionPersonne } from '../../../types/banking.types';
import { blocsManquants } from './computeScenarioCalcule';

/**
 * Personnes dont les revenus viennent des calculateurs (et non des phases et pensions saisies) :
 * la personne 1, et la personne 2 si son salaire est paramétré. Vide si les calculateurs sont
 * inactifs ou incomplets (le moteur retombe alors sur les phases saisies).
 */
export function personnesCalculees(params: ProjectionParams): ProjectionPersonne[] {
  if (!params.calculateurs?.actif || blocsManquants(params).length > 0) return [];
  const [p1, p2] = params.personnes;
  const avecP2 = p2 !== undefined && params.calculateurs.activite?.personne2 !== undefined;
  return [p1, ...(avecP2 ? [p2] : [])].filter((p): p is ProjectionPersonne => p !== undefined);
}
