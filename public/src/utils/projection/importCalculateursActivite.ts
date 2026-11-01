import type { ProjectionActiviteParams, ProjectionParams } from '../../types/banking.types';
import { importLiberal } from './importCalculateursLiberal';
import { jour, nombre, onglet, type Lecteur } from './importCalculateursReader';
import { asNumber, normalizeLabel, readCell } from './xlsxSheetReader';

/** Mesures cibles par scénario (①b : table « N° scénario / Scénario / Mesures cibles »), clés `s1`, `s2`… */
function mesuresParScenario(l: Lecteur): Record<string, number> {
  const o = onglet(l, 'foyer');
  const entete = o?.rows.find((r) => r.norm === normalizeLabel('N° scénario'));
  const out: Record<string, number> = {};
  if (!o || !entete) return out;
  for (let row = entete.index + 1; typeof readCell(o.ws, row, 0) === 'number'; row += 1)
    out[`s${readCell(o.ws, row, 0)}`] = asNumber(readCell(o.ws, row, 2)) ?? 0;
  return out;
}

/** Paramètres du calculateur d'activité de la personne 1 (①, ①b, ②, ②b, ⑥, Hypothèses). */
export function importActivite(
  l: Lecteur,
  personnes: ProjectionParams['personnes'],
): ProjectionActiviteParams {
  const [p1, p2] = personnes;
  const hyp = (starts: string, nom: string) => nombre(l, 'hyp', { starts }, nom);
  const foyer = (starts: string, nom: string, nth = 0) =>
    nombre(l, 'foyer', { starts }, nom, { nth });
  const rupture = (starts: string, nom: string) => nombre(l, 'rupture', { starts }, nom);
  const salarie = (starts: string, nom: string) => nombre(l, 'salarie', { starts }, nom);
  // Personne 2 : paie validée × nombre de mois rémunérés ÷ 12, comme le « lissé sur 12 mois » de ①b.
  const moisPayesP2 = foyer(
    'nombre de mois remuneres par an',
    'Nombre de mois rémunérés (personne 2)',
  );
  const p2Params: ProjectionActiviteParams['personne2'] = p2?.dateNaissance
    ? {
        dateNaissance: p2.dateNaissance,
        ageFinActivite: p2.ageFinActivite ?? 0,
        netAvantPasMensuel:
          (foyer('net avant pas (', 'Net avant PAS (personne 2)', 1) * moisPayesP2) / 12,
        netImposableMensuel:
          (foyer('net imposable (', 'Net imposable (personne 2)', 1) * moisPayesP2) / 12,
        salaireBrutAnnuel: foyer('salaire brut annuel', 'Salaire brut annuel (personne 2)'),
        revalorisationAnnuelle: hyp(
          'revalorisation annuelle du salaire de',
          'Revalorisation du salaire (personne 2)',
        ),
        anneeReference: foyer('annee de reference des prix', 'Année de référence'),
      }
    : undefined;
  return {
    personne1: {
      dateNaissance: p1?.dateNaissance ?? '',
      ageDepartRetraite: p1?.ageFinActivite ?? 0,
    },
    paie: {
      netAvantPas: foyer('net avant pas (', 'Net avant PAS (personne 1)', 0),
      netImposable: foyer('net imposable (', 'Net imposable (personne 1)', 0),
      moisPayesParAn: foyer('nombre de mois payes par an', 'Nombre de mois payés par an'),
      ratioImposableRemplacement: foyer(
        'ratio net imposable / net verse',
        'Ratio net imposable / net versé',
      ),
    },
    calendrier: {
      dateNotification: jour(
        l,
        'rupture',
        { starts: 'date de notification' },
        'Date de notification',
      ),
      delaiReflexionJours: rupture('delai de reflexion', 'Délai de réflexion'),
      dureePreavisMois: rupture('duree du preavis', 'Durée du préavis'),
      dureeCongeMois: hyp('duree du conge de reclassement', 'Durée du congé de reclassement'),
      debutAssociation: jour(
        l,
        'hyp',
        { starts: "debut de l'activite mjpm" },
        'Début en association',
      ),
      dateBasculeLiberal: jour(
        l,
        'hyp',
        { starts: 'date de bascule en liberal' },
        'Bascule en libéral',
      ),
    },
    reclassement: {
      tauxAllocation: hyp("taux de l'allocation de reclassement", "Taux de l'allocation"),
      brutMensuelReference: rupture('base brut mensuel', 'Brut mensuel de référence'),
      assietteAgircArrcoMensuelle:
        rupture('assiette mensuelle agirc-arrco', 'Assiette Agirc-Arrco') *
        rupture('clause agirc-arrco active', 'Clause Agirc-Arrco'),
    },
    are: {
      sjr: nombre(l, 'are', { starts: 'salaire journalier de reference' }, 'SJR'),
      assietteSupralegale: rupture('part supra-legale', 'Part supra-légale'),
      iccpBrute: rupture('indemnite compensatrice cp', 'Indemnité compensatrice de CP'),
    },
    ccn66: {
      coefficient: hyp('coefficient ccn 66', 'Coefficient CCN 66'),
      valeurPoint: hyp('valeur du point ccn 66', 'Valeur du point CCN 66'),
      cti: salarie('cti', 'CTI'),
      tauxCotisationsSalariales: salarie('cotisations salariales', 'Cotisations salariales'),
      progressionAnnuelle: hyp(
        'progression annuelle du salaire en association',
        'Progression du salaire',
      ),
    },
    liberal: importLiberal(l),
    scenarios: mesuresParScenario(l),
    irImpute: {
      revenuImposableAutrePersonne: rupture(
        'revenu annuel imposable conjoint',
        'Revenu imposable du conjoint',
      ),
      parts: rupture('nombre de parts fiscales', 'Parts fiscales'),
    },
    ...(p2Params ? { personne2: p2Params } : {}),
  };
}
