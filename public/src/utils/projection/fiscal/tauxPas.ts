import { GRILLE_TAUX_DEFAUT } from './constants';
import { indiceBareme } from './baremeIr';

/** ROUND(x; 3) d'Excel : calcul sur 15 chiffres significatifs, arrondi au 1/1000 (positifs). */
export function round3(x: number): number {
  return Math.round(Number((x * 1000).toPrecision(15))) / 1000;
}

/** Taux de la grille par défaut pour une base mensuelle, seuils indexés depuis l'année de la grille (⑫ U). */
export function tauxGrilleDefaut(
  baseMensuelle: number,
  annee: number,
  indexation: number,
  anneeGrille: number = GRILLE_TAUX_DEFAUT.annee,
): number {
  const indice = indiceBareme(annee, indexation, anneeGrille);
  let taux = 0;
  for (const borne of GRILLE_TAUX_DEFAUT.bornes) {
    if (borne.seuilMensuel * indice > baseMensuelle) break;
    taux = borne.taux;
  }
  return taux;
}

export interface TauxPasInput {
  annee: number;
  /** Net imposable annualisé de la personne 1, BNC compris (⑫ F) et de la personne 2 (⑫ G), avant abattement. */
  revenuP1: number;
  revenuP2: number;
  /** IR net du foyer de l'année. */
  irNet: number;
  tauxIndividualises: boolean;
  indexation: number;
  anneeGrille?: number;
}

export interface TauxPasResultat {
  tauxFoyer: number;
  tauxP1: number;
  tauxP2: number;
}

/** Complément de taux pour que le PAS du foyer égale l'IR : (IR − PAS de l'autre) / revenu, ≥ 0, arrondi. */
function tauxComplement(irNet: number, pasAutre: number, revenu: number, repli: number): number {
  return revenu > 0 ? Math.max(0, round3((irNet - pasAutre) / revenu)) : repli;
}

/**
 * Taux de PAS de l'année (⑫ S à X). Taux du foyer = IR / revenus arrondi au 1/1000. En mode
 * individualisé, la personne la moins payée (revenu P1 ≤ revenu P2 : P1) reçoit le taux de la grille
 * par défaut plafonné au taux du foyer, l'autre reçoit le complément ; sinon taux commun.
 */
export function tauxPasAnnee(input: TauxPasInput): TauxPasResultat {
  const { annee, revenuP1: f, revenuP2: g, irNet, indexation } = input;
  const tauxFoyer = f + g > 0 ? round3(irNet / (f + g)) : 0;
  if (!input.tauxIndividualises) return { tauxFoyer, tauxP1: tauxFoyer, tauxP2: tauxFoyer };
  const baseMensuelle = Math.max(0, Math.min(f, g)) / 12;
  const grille = tauxGrilleDefaut(baseMensuelle, annee, indexation, input.anneeGrille);
  const tauxMoinsPaye = Math.min(grille, tauxFoyer);
  if (f <= g) {
    const tauxP2 = tauxComplement(irNet, Math.max(0, f) * tauxMoinsPaye, g, tauxFoyer);
    return { tauxFoyer, tauxP1: tauxMoinsPaye, tauxP2 };
  }
  const tauxP1 = tauxComplement(irNet, g * tauxMoinsPaye, f, tauxFoyer);
  return { tauxFoyer, tauxP1, tauxP2: tauxMoinsPaye };
}
