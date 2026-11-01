import React from 'react';
import type { ProjectionActiviteParams } from '../../../../types/banking.types';
import { NumberField } from '../FormFields';
import { CalcBlock } from './CalcBlock';
import { patchOf } from './calcUtils';

interface Props {
  value: ProjectionActiviteParams;
  onChange: (next: ProjectionActiviteParams) => void;
}

/** Congé de reclassement, ARE et salariat en association (CCN 66). */
export const ActiviteIndemnitesFields: React.FC<Props> = ({ value, onChange }) => {
  const setRecl = patchOf(value, 'reclassement', onChange);
  const setAre = patchOf(value, 'are', onChange);
  const setCcn = patchOf(value, 'ccn66', onChange);
  const { reclassement, are, ccn66 } = value;

  return (
    <>
      <CalcBlock title="Congé de reclassement">
        <NumberField
          label="Taux de l'allocation de reclassement"
          percent
          value={reclassement.tauxAllocation}
          onChange={(v) => setRecl({ tauxAllocation: v ?? 0 })}
        />
        <NumberField
          label="Brut mensuel de référence (€)"
          hint="13e mois inclus, divisé par 12"
          value={reclassement.brutMensuelReference}
          onChange={(v) => setRecl({ brutMensuelReference: v ?? 0 })}
        />
        <NumberField
          label="Assiette mensuelle Agirc-Arrco maintenue (€)"
          value={reclassement.assietteAgircArrcoMensuelle}
          onChange={(v) => setRecl({ assietteAgircArrcoMensuelle: v ?? 0 })}
        />
      </CalcBlock>
      <CalcBlock title="Assurance chômage (ARE)">
        <NumberField
          label="Salaire journalier de référence (€)"
          value={are.sjr}
          onChange={(v) => setAre({ sjr: v ?? 0 })}
        />
        <NumberField
          label="Part supra-légale et transactionnelle, brute (€)"
          value={are.assietteSupralegale}
          onChange={(v) => setAre({ assietteSupralegale: v ?? 0 })}
        />
        <NumberField
          label="Indemnité compensatrice de congés payés, brute (€)"
          value={are.iccpBrute}
          onChange={(v) => setAre({ iccpBrute: v ?? 0 })}
        />
      </CalcBlock>
      <CalcBlock title="Salariat en association (CCN 66)">
        <NumberField
          label="Coefficient CCN 66"
          value={ccn66.coefficient}
          onChange={(v) => setCcn({ coefficient: v ?? 0 })}
        />
        <NumberField
          label="Valeur du point CCN 66 (€)"
          value={ccn66.valeurPoint}
          onChange={(v) => setCcn({ valeurPoint: v ?? 0 })}
        />
        <NumberField
          label="Complément de traitement indiciaire (€ brut par mois)"
          value={ccn66.cti}
          onChange={(v) => setCcn({ cti: v ?? 0 })}
        />
        <NumberField
          label="Cotisations salariales"
          percent
          value={ccn66.tauxCotisationsSalariales}
          onChange={(v) => setCcn({ tauxCotisationsSalariales: v ?? 0 })}
        />
        <NumberField
          label="Progression annuelle du salaire"
          percent
          value={ccn66.progressionAnnuelle}
          onChange={(v) => setCcn({ progressionAnnuelle: v ?? 0 })}
        />
      </CalcBlock>
    </>
  );
};
