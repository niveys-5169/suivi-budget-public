import React from 'react';
import type { ProjectionActiviteParams } from '../../../../types/banking.types';
import { COTISATIONS_LIBERAL } from '../../../../utils/projection/activite/constants';
import { NumberField } from '../FormFields';
import { CalcBlock } from './CalcBlock';
import { SwitchField, TripletField } from './CalcFields';
import { patchOf } from './calcUtils';
import { ChargesLiberalesEditor } from './ChargesLiberalesEditor';

interface Props {
  value: ProjectionActiviteParams;
  onChange: (next: ProjectionActiviteParams) => void;
}

/** Cabinet libéral : tarif, montée en charge, charges, cotisations et versement PER. */
export const ActiviteLiberalFields: React.FC<Props> = ({ value, onChange }) => {
  const setLib = patchOf(value, 'liberal', onChange);
  const { liberal } = value;

  return (
    <>
      <CalcBlock title="Activité libérale">
        <NumberField
          label="Tarif moyen par mesure (€)"
          value={liberal.tarifMesure}
          onChange={(v) => setLib({ tarifMesure: v ?? 0 })}
        />
        <NumberField
          label="Mesures de référence du budget"
          hint="Nombre de mesures auquel correspondent les charges ci-dessous"
          value={liberal.mesuresReference}
          onChange={(v) => setLib({ mesuresReference: v ?? 0 })}
        />
        <NumberField
          label="Versement PER TNS annuel (€)"
          value={liberal.perAnnuel}
          onChange={(v) => setLib({ perAnnuel: v ?? 0 })}
        />
        <SwitchField
          label="PER TNS en sortie de cash"
          hint="Le versement sort de la trésorerie du mois"
          checked={liberal.perSortieDeCash ?? true}
          onChange={(perSortieDeCash) => setLib({ perSortieDeCash })}
        />
      </CalcBlock>
      <CalcBlock title="Montée en charge" hint="Part des mesures cibles atteinte, par année">
        <TripletField
          label="Part des mesures cibles"
          percent
          value={liberal.monteeEnCharge}
          onChange={(monteeEnCharge) => setLib({ monteeEnCharge })}
        />
        <TripletField
          label="Coefficient CFE"
          value={liberal.coefficientCfe}
          onChange={(coefficientCfe) => setLib({ coefficientCfe })}
        />
        <TripletField
          label="Cotisation maladie-maternité"
          percent
          hint="Taux dégressif selon l'année d'activité"
          value={liberal.tauxMaladieMaternite ?? COTISATIONS_LIBERAL.maladieMaternitePourAnnee}
          onChange={(tauxMaladieMaternite) => setLib({ tauxMaladieMaternite })}
        />
      </CalcBlock>
      <ChargesLiberalesEditor value={liberal.charges} onChange={(charges) => setLib({ charges })} />
    </>
  );
};
