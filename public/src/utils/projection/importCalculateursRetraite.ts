import type {
  ProjectionRetraiteParams,
  ProjectionRetraitePersonneParams,
} from '../../types/banking.types';
import { NOMBRE_MEILLEURES_ANNEES } from './retraite/constants';
import { nombre, onglet, type Lecteur } from './importCalculateursReader';
import { asNumber, normalizeLabel, readCell } from './xlsxSheetReader';

/** Dernière année entièrement couverte par les relevés de carrière du classeur (au 31/12/2025). */
const ANNEE_RELEVE = 2025;

/** Salaires bruts du relevé de la personne 1, par année ≤ relevé (③b : salaire du relevé, à défaut retenu). */
function salairesPasses(l: Lecteur): Record<string, number> {
  const o = onglet(l, 'sam');
  const entete = o?.rows.find(
    (r) => r.norm === 'annee' && normalizeLabel(r.cells[1]).startsWith('pass'),
  );
  const out: Record<string, number> = {};
  if (!o || !entete) return out;
  for (let row = entete.index + 1; typeof readCell(o.ws, row, 0) === 'number'; row += 1) {
    const annee = Number(readCell(o.ws, row, 0));
    const salaire = asNumber(readCell(o.ws, row, 3)) ?? asNumber(readCell(o.ws, row, 4)) ?? 0;
    if (annee <= ANNEE_RELEVE && salaire > 0) out[String(annee)] = salaire;
  }
  return out;
}

/** Paramètres de retraite : Hypothèses bloc 5 (libellés), ③b (BNC de référence, salaires du relevé). */
export function importRetraite(
  l: Lecteur,
  personneIds: [string, string | undefined],
): ProjectionRetraiteParams {
  const hyp = (starts: string, nom: string, nth = 0) => nombre(l, 'hyp', { starts }, nom, { nth });
  const commun = {
    anneeReleve: ANNEE_RELEVE,
    valeurPointAgircArrco: hyp(
      'valeur de service du point agirc-arrco',
      'Valeur du point Agirc-Arrco',
    ),
    prixPointAgircArrco: hyp("prix d'achat du point agirc-arrco", "Prix d'achat du point"),
    bncReferenceCipav: nombre(
      l,
      'sam',
      { starts: 'revenu bnc correspondant' },
      'BNC de référence Cipav',
    ),
    valeurPointCipav: hyp('valeur du point cipav', 'Valeur du point Cipav'),
    tauxPrelevementsSociaux: hyp('prelevements sociaux du retraite', 'Prélèvements sociaux'),
    revalorisationSalaires: hyp(
      'revalorisation des salaires portes au compte',
      'Revalorisation des salaires',
    ),
    croissancePass: hyp('croissance annuelle du pass', 'Croissance du PASS'),
    nombreMeilleuresAnnees: NOMBRE_MEILLEURES_ANNEES,
  };
  const p1: ProjectionRetraitePersonneParams = {
    ...commun,
    personneId: personneIds[0],
    trimestresValides: hyp('trimestres valides au', 'Trimestres validés'),
    trimestresRequis: hyp('trimestres requis pour le taux plein', 'Trimestres requis', 0),
    pointsAgircArrco: hyp('points agirc-arrco deja acquis', 'Points Agirc-Arrco acquis'),
    pointsCipavParAn: hyp('points cipav acquis par an', 'Points Cipav par an'),
    rentePerMensuelle: hyp('rente per', 'Rente PER'),
    salairesPasses: salairesPasses(l),
  };
  const personnes = [p1];
  if (personneIds[1])
    personnes.push({
      ...commun,
      personneId: personneIds[1],
      trimestresValides: hyp('trimestres valides par', 'Trimestres validés (personne 2)'),
      trimestresRequis: hyp(
        'trimestres requis pour le taux plein',
        'Trimestres requis (personne 2)',
        1,
      ),
      pointsAgircArrco: hyp('points agirc-arrco acquis par', 'Points Agirc-Arrco (personne 2)'),
      pointsCipavParAn: 0,
      rentePerMensuelle: 0,
    });
  return {
    personnes,
    partCsgDeductible: hyp(
      'part deductible de la csg sur les pensions',
      'Part déductible de la CSG',
    ),
  };
}
