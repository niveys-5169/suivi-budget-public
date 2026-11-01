/** Carrière de la personne 2 pour le calculateur de retraite (③c colonnes A à C, B57). */
import type {
  ProjectionActiviteParams,
  ProjectionRetraiteCarriereAnnee,
  ProjectionRetraitePersonneParams,
} from '../../../types/banking.types';
import { pointsAgircArrcoAnnee } from '../retraite/agircArrco';

type Personne2 = NonNullable<ProjectionActiviteParams['personne2']>;

/** Salaires bruts de la personne 2 de l'année du relevé à sa fin d'activité (③c B25:C49) ; undefined sans salaire de référence. */
export function carriereP2(
  p2: Personne2,
  anneeReleve: number,
): ProjectionRetraiteCarriereAnnee[] | undefined {
  if (p2.salaireBrutAnnuel === undefined) return undefined;
  const [naissance = 0, moisNaissance = 1] = p2.dateNaissance.split('-').map(Number);
  const anneeFin = naissance + p2.ageFinActivite;
  const carriere: ProjectionRetraiteCarriereAnnee[] = [];
  for (let annee = anneeReleve; annee <= anneeFin; annee += 1) {
    const mois =
      annee < p2.anneeReference
        ? 12
        : Math.min(12, Math.max(0, (anneeFin - annee) * 12 + moisNaissance - 1));
    const brut =
      p2.salaireBrutAnnuel * (1 + p2.revalorisationAnnuelle) ** (annee - p2.anneeReference);
    carriere.push({ annee, salaireRG: (brut * mois) / 12 });
  }
  return carriere;
}

/**
 * Paramètres retraite de la personne 2 : ③c ajoute les points de l'année du relevé (estimée) aux points
 * déjà acquis à la fin de cette année (③c B57 = B16 + H50, dont H25).
 */
export function paramsRetraiteP2(
  params: ProjectionRetraitePersonneParams,
  carriere: ProjectionRetraiteCarriereAnnee[],
): ProjectionRetraitePersonneParams {
  const releve = carriere.find((c) => c.annee === params.anneeReleve);
  if (!releve) return params;
  const points = pointsAgircArrcoAnnee(releve.salaireRG ?? 0, releve.annee, {
    ...params,
    prixPoint: params.prixPointAgircArrco,
  });
  return { ...params, pointsAgircArrco: params.pointsAgircArrco + points };
}
