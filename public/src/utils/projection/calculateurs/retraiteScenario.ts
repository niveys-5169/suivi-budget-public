import type {
  ProjectionActiviteParams,
  ProjectionRetraiteParams,
  ProjectionRetraiteResultat,
} from '../../../types/banking.types';
import { computeRetraitePersonne } from '../retraite/computeRetraite';
import { carriereP1 } from './carriere';
import { carriereP2, paramsRetraiteP2 } from './carriereP2';

export interface RetraitesScenario {
  p1: ProjectionRetraiteResultat;
  /** Absent sans personne 2, sans paramètres de retraite pour elle ou sans salaire de référence. */
  p2?: ProjectionRetraiteResultat;
}

/** Retraite des deux personnes pour un scénario : carrière annuelle (③b, ③c) puis liquidation. */
export function retraitesScenario(
  activite: ProjectionActiviteParams,
  retraite: ProjectionRetraiteParams,
  ids: { p1: string; p2?: string },
  scenarioId: string,
): RetraitesScenario | undefined {
  const params1 = retraite.personnes.find((p) => p.personneId === ids.p1);
  if (!params1) return undefined;
  const c1 = carriereP1(activite, params1, activite.scenarios[scenarioId] ?? 0);
  const params2 = retraite.personnes.find((p) => p.personneId === ids.p2);
  const carriere2 =
    activite.personne2 && params2 ? carriereP2(activite.personne2, params2.anneeReleve) : undefined;
  return {
    p1: computeRetraitePersonne({ params: params1, ...c1 }),
    ...(carriere2 && params2
      ? {
          p2: computeRetraitePersonne({
            params: paramsRetraiteP2(params2, carriere2),
            carriere: carriere2,
          }),
        }
      : {}),
  };
}
