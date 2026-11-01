/** Allocation de congé de reclassement (① B51:B53, B159:B186 : CSG/CRDS et part salariale Agirc-Arrco). */
import { PART_SALARIALE_AGIRC_ARRCO, PASS_ANNUEL, TAUX_CSG_CRDS_RECLASSEMENT } from './constants';

/** Part salariale Agirc-Arrco prélevée sur l'allocation, pour une assiette mensuelle maintenue (① B183:B186). */
export function partSalarialeAgircArrco(assietteMensuelle: number): number {
  const pass = PASS_ANNUEL / 12;
  const tranche1 = Math.min(assietteMensuelle, pass);
  const tranche2 = Math.max(0, assietteMensuelle - pass);
  const cet = assietteMensuelle > pass ? assietteMensuelle * PART_SALARIALE_AGIRC_ARRCO.cet : 0;
  return (
    tranche1 * PART_SALARIALE_AGIRC_ARRCO.tranche1 +
    tranche2 * PART_SALARIALE_AGIRC_ARRCO.tranche2 +
    cet
  );
}

export interface ReclassementInput {
  tauxAllocation: number;
  brutMensuelReference: number;
  assietteAgircArrcoMensuelle: number;
}

/** Allocation nette mensuelle : brut × taux, après CSG/CRDS et part salariale de retraite (① B53). */
export function allocationReclassementNette(input: ReclassementInput): number {
  const brut = input.brutMensuelReference * input.tauxAllocation;
  return (
    brut * (1 - TAUX_CSG_CRDS_RECLASSEMENT) -
    partSalarialeAgircArrco(input.assietteAgircArrcoMensuelle)
  );
}
