/** Revenus d'activité mensuels de la personne 1 : assemblage des onglets ①, ②, ②b, ⑥ (Calc colonnes B à D, R, Z à BC). */
import type {
  ProjectionActiviteMois,
  ProjectionActiviteParams,
  ProjectionMonth,
} from '../../../types/banking.types';
import { computeAre, computeDifferesJours } from './are';
import { computeCalendrier, fractionsMois } from './calendrier';
import { civilFromDay, dayNumber } from './dates';
import { computeLiberalAnnees } from './liberal';
import { anneeLiberal, codePhase, libellePhase } from './phases';
import { allocationReclassementNette } from './reclassement';
import { brutMensuelAn1, computeComplementAre, netSalaireAssociation } from './salariat';

export interface ActiviteInput {
  /** Premier et dernier mois calculés (YYYY-MM, bornes incluses). */
  horizon: { debut: ProjectionMonth; fin: ProjectionMonth };
  params: ProjectionActiviteParams;
  /** Taux PAS de la personne 1 par année civile (calculateur fiscal) ; sert au revenu manquant après PAS. */
  tauxPasParAnnee?: Record<number, number>;
}

const parseMois = (mois: ProjectionMonth): number => {
  const [annee = 0, m = 1] = mois.split('-').map(Number);
  return annee * 12 + m - 1;
};

/** Salaire de la personne 2 : indice de revalorisation, nul à partir de la fin d'activité (Calc AS). */
function indicePersonne2(p2: NonNullable<ProjectionActiviteParams['personne2']>, debut: number) {
  const [anneeNaissance = 0, moisNaissance = 1] = p2.dateNaissance.split('-').map(Number);
  const fin = dayNumber(anneeNaissance + p2.ageFinActivite, moisNaissance, 1);
  const annee = civilFromDay(debut).year;
  return debut < fin ? (1 + p2.revalorisationAnnuelle) ** (annee - p2.anneeReference) : 0;
}

export function computeActivitePersonne1(
  input: ActiviteInput,
  scenario: string,
): ProjectionActiviteMois[] {
  const { params } = input;
  const { paie, ccn66, liberal } = params;
  const mesuresCibles = params.scenarios[scenario] ?? 0;
  const are = computeAre(params.are.sjr);
  const brutAn1 = brutMensuelAn1(ccn66);
  const complement = computeComplementAre(are, brutAn1);
  const cal = computeCalendrier({
    params,
    mesuresCibles,
    differesJours: computeDifferesJours({ ...params.are }),
    dureePleinMois: complement.dureePleinMois,
    dureeTotaleMois: complement.dureeTotaleMois,
  });
  const annees = computeLiberalAnnees(liberal, mesuresCibles, params.irImpute);
  const mesuresParAnnee = annees.map((a) => a.mesures);
  const allocation = allocationReclassementNette(params.reclassement);
  const ratioActivite = paie.netImposable / paie.netAvantPas;
  const ratioRemplacement = paie.ratioImposableRemplacement;
  const lissage = paie.moisPayesParAn / 12;
  const debutAssociation = civilFromDay(cal.debutAssociation);
  const anneeBascule = civilFromDay(cal.bascule).year;
  const resultat: ProjectionActiviteMois[] = [];

  for (
    let index = parseMois(input.horizon.debut);
    index <= parseMois(input.horizon.fin);
    index += 1
  ) {
    const annee = Math.floor(index / 12);
    const debut = dayNumber(annee, (index % 12) + 1, 1);
    const retraite = debut > cal.moisDepartRetraite;
    const f = fractionsMois(debut, cal, retraite);
    const k = Math.max(
      0,
      Math.floor(
        ((annee - debutAssociation.year) * 12 + (index % 12) + 1 - debutAssociation.month) / 12,
      ),
    );
    const netSalaire = netSalaireAssociation(ccn66, k);
    const anneeLib = anneeLiberal(annee, anneeBascule);
    const lib = annees[anneeLib - 1];
    const code = codePhase(debut, cal, retraite, anneeLib);
    const complementNet =
      f.arePlein * complement.netPlein + f.areDegressif * complement.netDegressif;
    const liberalNetAvantImpot = (f.liberal * ((lib?.bnc ?? 0) - (lib?.cotisations ?? 0))) / 12;
    const imposableHorsLiberal =
      f.emploi * paie.netImposable * lissage +
      f.conge * allocation * ratioRemplacement +
      f.association * netSalaire * ratioActivite +
      complementNet * ratioRemplacement;
    const bncImposable = (f.liberal * (lib?.bncImposable ?? 0)) / 12;
    const manquantNet = f.differeAre * complement.netPlein + f.trou * netSalaire;
    const manquantImposable =
      f.differeAre * complement.netPlein * ratioRemplacement + f.trou * netSalaire * ratioActivite;
    const tauxPas = input.tauxPasParAnnee?.[annee] ?? 0;
    const indice2 = params.personne2 ? indicePersonne2(params.personne2, debut) : 0;
    resultat.push({
      mois: `${annee}-${String((index % 12) + 1).padStart(2, '0')}`,
      phase: libellePhase(code, debut, cal, mesuresParAnnee),
      codePhase: code,
      netAvantPas:
        f.emploi * paie.netAvantPas * lissage +
        f.conge * allocation +
        f.association * netSalaire +
        complementNet +
        liberalNetAvantImpot,
      netImposable: imposableHorsLiberal + bncImposable,
      netImposableHorsLiberal: imposableHorsLiberal,
      bncImposable,
      liberalNetAvantImpot,
      liberalIrImpute: (f.liberal * (lib?.irImpute ?? 0)) / 12,
      per: (f.liberal * liberal.perAnnuel) / 12,
      revenuManquantNet: manquantNet,
      revenuManquantImposable: manquantImposable,
      revenuManquant: manquantNet - tauxPas * manquantImposable,
      fractions: f,
      anneeAssociation: k,
      netSalaireAssociation: netSalaire,
      netAvantPasPersonne2: (params.personne2?.netAvantPasMensuel ?? 0) * indice2,
      netImposablePersonne2: (params.personne2?.netImposableMensuel ?? 0) * indice2,
    });
  }
  return resultat;
}
