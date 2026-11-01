/** Carrière de la personne 2 pour le calculateur de retraite (③c colonnes A à C, B57). */
import type {
  ProjectionActiviteParams,
  ProjectionRetraiteCarriereAnnee,
} from '../../../types/banking.types';

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
