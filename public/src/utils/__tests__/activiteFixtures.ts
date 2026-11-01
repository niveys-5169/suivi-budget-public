import type { ProjectionActiviteParams } from '../../types/banking.types';

/** Paramètres SYNTHÉTIQUES (valeurs rondes, aucune donnée personnelle) du calculateur d'activité. */
export const activiteParams: ProjectionActiviteParams = {
  personne1: { dateNaissance: '1980-06-15', ageDepartRetraite: 62 }, // dernier mois d'activité : 2042-06
  paie: {
    netAvantPas: 3000,
    netImposable: 3300,
    moisPayesParAn: 12,
    ratioImposableRemplacement: 1,
  },
  calendrier: {
    dateNotification: '2030-01-02', // + 8 jours : congé à partir du 10/01/2030
    delaiReflexionJours: 8,
    dureePreavisMois: 3, // fin de préavis : 10/04/2030
    dureeCongeMois: 12, // fin du congé : 10/01/2031
    debutAssociation: '2031-03-01',
    dateBasculeLiberal: '2036-01-01',
  },
  reclassement: {
    tauxAllocation: 0.7,
    brutMensuelReference: 5000,
    assietteAgircArrcoMensuelle: 4000,
  },
  // différés : 4 472 / 111,8 = 40 j, ICCP 2 000 / 200 = 10 j, attente 7 j = 57 j
  are: { sjr: 200, assietteSupralegale: 4472, iccpBrute: 2000 },
  ccn66: {
    coefficient: 400,
    valeurPoint: 4,
    cti: 200,
    tauxCotisationsSalariales: 0.2,
    progressionAnnuelle: 0.02,
  },
  liberal: {
    tarifMesure: 100,
    monteeEnCharge: [0.5, 0.75, 1],
    mesuresReference: 10,
    charges: [
      { libelle: 'Loyer', montantReference: 1000, nature: 'fixe' },
      { libelle: 'Déplacements', montantReference: 2000, nature: 'variable' },
      { libelle: 'CFE', montantReference: 400, nature: 'cfe' },
    ],
    coefficientCfe: [0, 0.5, 1],
    perAnnuel: 1200,
  },
  scenarios: { association: 0, liberal: 20 },
};
