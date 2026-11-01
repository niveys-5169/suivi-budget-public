/** Salariat en association (CCN 66) et cumul ARE + salaire (②b B4:B34). */
import type { ProjectionActiviteParams } from '../../../types/banking.types';
import type { AreResultat } from './are';
import { ARE, CCN66, CUMUL_ARE_SALAIRE_TAUX, JOURS_ARE_PAR_MOIS } from './constants';

type Ccn66Params = ProjectionActiviteParams['ccn66'];

/** Brut mensuel de l'année 1 : MAX(coefficient × point × (1 + sujétion) ; SMIC) + CTI (②b B7:B10). */
export function brutMensuelAn1(ccn: Ccn66Params): number {
  const indiciaire = ccn.valeurPoint * ccn.coefficient * (1 + CCN66.tauxSujetionSpeciale);
  return Math.max(indiciaire, CCN66.smicMensuelBrut) + ccn.cti;
}

/** Net mensuel d'un salarié en association à la `k`-ième année d'ancienneté (0 = première) (②b B19:F19, Calc AR). */
export function netSalaireAssociation(ccn: Ccn66Params, anneeAssociation: number): number {
  const brut = brutMensuelAn1(ccn) * (1 + ccn.progressionAnnuelle) ** anneeAssociation;
  return brut * (1 - ccn.tauxCotisationsSalariales);
}

export interface ComplementAre {
  /** Complément brut mensuel : ARE mensuelle − 70 % du brut repris, plein tarif puis dégressif (②b B26:B27). */
  brutPlein: number;
  brutDegressif: number;
  /** Durée de chaque phase en mois : les droits se consomment au prorata (②b B28:B29). */
  dureePleinMois: number;
  dureeDegressifMois: number;
  /** Durée totale plafonnée par le délai de déchéance (②b B30). */
  dureeTotaleMois: number;
  /** Complément net mensuel après prélèvements sociaux (②b B31:B32). */
  netPlein: number;
  netDegressif: number;
}

/** Cumul ARE + salaire d'association, calculé sur le brut de l'année 1 (②b B26:B32). */
export function computeComplementAre(are: AreResultat, brutAn1: number): ComplementAre {
  const reduction = CUMUL_ARE_SALAIRE_TAUX * brutAn1;
  const brutPlein = Math.max(0, are.allocationJournaliere * JOURS_ARE_PAR_MOIS - reduction);
  const brutDegressif = Math.max(0, are.allocationDegressive * JOURS_ARE_PAR_MOIS - reduction);
  const dureePleinMois =
    brutPlein > 0 ? (ARE.joursPleinTarif * are.allocationJournaliere) / brutPlein : 0;
  const dureeDegressifMois =
    brutDegressif > 0 ? (ARE.joursDegressifs * are.allocationDegressive) / brutDegressif : 0;
  return {
    brutPlein,
    brutDegressif,
    dureePleinMois,
    dureeDegressifMois,
    dureeTotaleMois: Math.min(dureePleinMois + dureeDegressifMois, ARE.delaiDecheanceMois),
    netPlein: brutPlein * (1 - are.tauxPrelevements),
    netDegressif: brutDegressif * (1 - are.tauxPrelevements),
  };
}
