import type { ProjectionActiviteParams, ProjectionChargeLiberale } from '../../types/banking.types';
import { lignes, nombre, type Lecteur } from './importCalculateursReader';
import { asNumber, normalizeLabel } from './xlsxSheetReader';

const NATURES: Record<string, ProjectionChargeLiberale['nature']> = {
  fixe: 'fixe',
  variable: 'variable',
  cfe: 'cfe',
};

/** Postes de charges du cabinet (②) : lignes dont la colonne G porte la nature « Fixe », « Variable » ou « CFE ». */
function charges(l: Lecteur): ProjectionChargeLiberale[] {
  return lignes(l, 'liberal', {}).flatMap((row) => {
    const nature = NATURES[normalizeLabel(row.cells[6])];
    const montant = asNumber(row.cells[5]);
    return nature && montant !== undefined
      ? [{ libelle: row.label, montantReference: montant, nature }]
      : [];
  });
}

/** Paramètres du libéral (② budget et cotisations, Hypothèses : tarif, montée en charge, PER). */
export function importLiberal(l: Lecteur): ProjectionActiviteParams['liberal'] {
  const hyp = (starts: string, nom: string, contains?: string[]) =>
    nombre(l, 'hyp', { starts, contains }, nom);
  const liberal = (starts: string, nom: string, col = 1) =>
    nombre(l, 'liberal', { starts }, nom, { col });
  const cfe = (col: number) => liberal('coef. cfe', 'Coefficient CFE', col);
  const maladie = (col: number) => liberal('maladie-maternite', 'Maladie-maternité', col);
  const tranche = (n: number) =>
    hyp('montee en charge', `Montée en charge année ${n}`, [`annee ${n}`]);
  return {
    tarifMesure: hyp('tarif moyen par mesure', 'Tarif par mesure'),
    monteeEnCharge: [tranche(1), tranche(2), tranche(3)],
    mesuresReference: liberal('nb de mesures de reference', 'Mesures de référence'),
    charges: charges(l),
    coefficientCfe: [cfe(1), cfe(2), cfe(3)],
    perAnnuel: hyp('versement per tns annuel', 'PER TNS annuel'),
    perSortieDeCash:
      nombre(
        l,
        'foyer',
        { starts: 'versement', contains: ['per tns', 'sortie de cash'] },
        'PER TNS en sortie de cash',
      ) === 1,
    tauxMaladieMaternite: [maladie(1), maladie(2), maladie(3)],
  };
}
