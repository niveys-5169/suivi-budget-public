import React from 'react';
import { Button } from '../../../../ui';
import type { ProjectionActiviteParams, ProjectionParams } from '../../../../types/banking.types';
import { createDefaultPersonne2 } from '../../../../utils/projection/calculateurs/defaults';
import { DateField, NumberField } from '../FormFields';
import { CalcBlock } from './CalcBlock';

interface Props {
  value: ProjectionActiviteParams;
  draft: ProjectionParams;
  onChange: (next: ProjectionActiviteParams) => void;
}

/** Autre personne du foyer : IR imputé au libéral et salaire de la personne 2. */
export const ActiviteFoyerFields: React.FC<Props> = ({ value, draft, onChange }) => {
  const irImpute = value.irImpute ?? { revenuImposableAutrePersonne: 0, parts: 2 };
  const setIr = (patch: Partial<typeof irImpute>) =>
    onChange({ ...value, irImpute: { ...irImpute, ...patch } });
  const { personne2 } = value;
  const par = (patch: Partial<NonNullable<typeof personne2>>) => {
    if (personne2) onChange({ ...value, personne2: { ...personne2, ...patch } });
  };

  return (
    <>
      <CalcBlock title="Impôt imputé au libéral" hint="Foyer retenu pour l'impôt du cabinet">
        <NumberField
          label="Revenu imposable de l'autre personne (€ par an)"
          value={irImpute.revenuImposableAutrePersonne}
          onChange={(v) => setIr({ revenuImposableAutrePersonne: v ?? 0 })}
        />
        <NumberField
          label="Nombre de parts fiscales"
          value={irImpute.parts}
          onChange={(v) => setIr({ parts: v ?? 0 })}
        />
      </CalcBlock>
      {personne2 ? (
        <CalcBlock title="Personne 2" hint="Salaire lissé, revalorisé chaque 1er janvier">
          <DateField
            kind="date"
            label="Date de naissance (personne 2)"
            value={personne2.dateNaissance}
            onChange={(dateNaissance) => par({ dateNaissance })}
          />
          <NumberField
            label="Âge de fin d'activité (personne 2)"
            value={personne2.ageFinActivite}
            onChange={(v) => par({ ageFinActivite: v ?? 0 })}
          />
          <NumberField
            label="Net avant PAS mensuel (personne 2, €)"
            value={personne2.netAvantPasMensuel}
            onChange={(v) => par({ netAvantPasMensuel: v ?? 0 })}
          />
          <NumberField
            label="Net imposable mensuel (personne 2, €)"
            value={personne2.netImposableMensuel}
            onChange={(v) => par({ netImposableMensuel: v ?? 0 })}
          />
          <NumberField
            label="Salaire brut annuel (personne 2, €)"
            hint="Vide : pas de pension calculée pour la personne 2"
            optional
            value={personne2.salaireBrutAnnuel}
            onChange={(salaireBrutAnnuel) => par({ salaireBrutAnnuel })}
          />
          <NumberField
            label="Revalorisation annuelle du salaire (personne 2)"
            percent
            value={personne2.revalorisationAnnuelle}
            onChange={(v) => par({ revalorisationAnnuelle: v ?? 0 })}
          />
          <NumberField
            label="Année de la paie de référence (personne 2)"
            value={personne2.anneeReference}
            onChange={(v) => par({ anneeReference: v ?? 0 })}
          />
        </CalcBlock>
      ) : (
        <div>
          <Button
            size="sm"
            disabled={draft.personnes.length < 2}
            onClick={() => onChange({ ...value, personne2: createDefaultPersonne2(draft) })}
          >
            Ajouter le salaire de la personne 2
          </Button>
        </div>
      )}
    </>
  );
};
