import type { ProjectionParams, ProjectionRetraitePersonneParams } from '../../types/banking.types';
import { createDefaultProjectionParams } from '../projection/defaults';
import { activiteParams } from './activiteFixtures';

const retraiteBase = {
  trimestresValides: 100,
  anneeReleve: 2029,
  trimestresRequis: 172,
  pointsAgircArrco: 3000,
  valeurPointAgircArrco: 1.4,
  prixPointAgircArrco: 20,
  pointsCipavParAn: 380,
  bncReferenceCipav: 35000,
  valeurPointCipav: 0.6,
  rentePerMensuelle: 100,
  tauxPrelevementsSociaux: 0.09,
  revalorisationSalaires: 0.015,
  croissancePass: 0.02,
  nombreMeilleuresAnnees: 25,
} satisfies Omit<ProjectionRetraitePersonneParams, 'personneId'>;

/** Paramètres SYNTHÉTIQUES : deux personnes, horizon 2029-10 → 2043-12, scénarios s1 (association) et s2 (libéral). */
export function makeCalculateursParams(): ProjectionParams {
  const params = createDefaultProjectionParams(new Date(2029, 9, 1));
  params.horizon = { debut: '2029-10', fin: '2043-12', anneeReferencePrix: 2029 };
  params.personnes = [
    { id: 'p1', prenom: 'Alex', dateNaissance: '1980-06-15', ageFinActivite: 62 },
    { id: 'p2', prenom: 'Sam', dateNaissance: '1982-03-10', ageFinActivite: 61 },
  ];
  params.enfants = [{ id: 'e1', dateNaissance: '2015-04-01' }];
  params.macro = { inflation: 0.02, rendementCapital: 0.03, rendementPatrimoine: 0.03 };
  params.scenarios = [
    { id: 's1', nom: 'Association', phases: [], pensions: [] },
    { id: 's2', nom: 'Libéral', phases: [], pensions: [] },
  ];
  params.scenarioAfficheId = 's1';
  params.calculateurs = {
    actif: true,
    fiscal: {
      indexationBareme: { mode: 'inflation' },
      ageLimiteRattachement: 21,
      tauxIndividualises: true,
      premiereAnneeRecalculee: 2031,
      tauxReelsActuels: { p1: 0.07, p2: 0.04 },
    },
    retraite: {
      partCsgDeductible: 0.05,
      personnes: [
        { ...retraiteBase, personneId: 'p1', salairesPasses: { '2028': 45000, '2029': 46000 } },
        {
          ...retraiteBase,
          personneId: 'p2',
          trimestresValides: 80,
          pointsAgircArrco: 1500,
          pointsCipavParAn: 0,
          rentePerMensuelle: 0,
        },
      ],
    },
    activite: {
      ...structuredClone(activiteParams),
      personne2: {
        dateNaissance: '1982-03-10',
        ageFinActivite: 61,
        netAvantPasMensuel: 2000,
        netImposableMensuel: 2200,
        salaireBrutAnnuel: 30000,
        revalorisationAnnuelle: 0.02,
        anneeReference: 2029,
      },
      scenarios: { s1: 0, s2: 20 },
    },
  };
  return params;
}
