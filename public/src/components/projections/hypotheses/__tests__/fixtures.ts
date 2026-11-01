import { vi } from 'vitest';
import type { UseProjectionResult } from '../../../../hooks/useProjection';
import type { ProjectionParams } from '../../../../types/banking.types';
import { createDefaultProjectionParams } from '../../../../utils/projection/defaults';

/** Paramètres synthétiques : un scénario avec une phase, une dépense exceptionnelle. */
export function makeParams(): ProjectionParams {
  const base = createDefaultProjectionParams(new Date(2026, 0, 1));
  return {
    ...base,
    scenarios: [
      {
        id: 's1',
        nom: 'Scénario test',
        pensions: [],
        phases: [
          {
            id: 'ph1',
            personneId: 'p1',
            libelle: 'Activité',
            debut: '2026-01',
            netMensuel: { mode: 'manuel', manuel: 2000 },
            revalorisationAnnuelle: 0.01,
          },
        ],
      },
    ],
    depenses: {
      ...base.depenses,
      exceptionnelles: [{ id: 'e1', libelle: 'Toiture', montant: 8000, mois: '2028-06' }],
    },
  };
}

export function makeProjection(
  params: ProjectionParams,
  save = vi.fn().mockResolvedValue(undefined),
): UseProjectionResult {
  return {
    params,
    exists: true,
    save,
    observed: {
      periode: { debut: '2025-11-01', fin: '2026-10-31' },
      budgetReference: 3000,
      detailCategories: [
        { categorie: 'Courses', classe: 'depense', soldeNet: -6000, retenuAnnuel: 6000 },
        { categorie: 'Salaire', classe: 'revenu', soldeNet: 24000, retenuAnnuel: 0 },
      ],
      moyenneMensuelleParCategorie: { Courses: -500, Salaire: 2000 },
      credits: {},
      patrimoineHorsPer: 50000,
      epargneNetteMensuelle: null,
    },
    categories: ['Courses', 'Salaire'],
    credits: [],
    loading: false,
    error: null,
  } as unknown as UseProjectionResult;
}
