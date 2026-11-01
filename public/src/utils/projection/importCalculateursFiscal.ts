import type { ProjectionFiscalParams } from '../../types/banking.types';
import { nombre, type Lecteur } from './importCalculateursReader';

/** Paramètres du calculateur fiscal : ⑫ (répartition, 1re année recalculée), Hypothèses et ①b (taux réels). */
export function importFiscal(l: Lecteur): ProjectionFiscalParams {
  const taux = (nth: number) =>
    nombre(l, 'foyer', { starts: 'taux pas' }, 'Taux PAS actuel', { nth });
  return {
    indexationBareme: { mode: 'inflation' },
    ageLimiteRattachement: nombre(
      l,
      'hyp',
      { starts: 'age limite de rattachement fiscal' },
      'Âge limite de rattachement fiscal',
    ),
    tauxIndividualises:
      nombre(l, 'pas', { starts: 'repartition' }, 'Répartition des taux PAS') === 1,
    premiereAnneeRecalculee: nombre(
      l,
      'pas',
      { starts: 'premiere annee recalculee' },
      'Première année recalculée',
    ),
    tauxReelsActuels: { p1: taux(0), p2: taux(1) },
    irLiberalParTaux: nombre(l, 'pas', { starts: 'ir liberal dans' }, 'IR du libéral') === 1,
  };
}
