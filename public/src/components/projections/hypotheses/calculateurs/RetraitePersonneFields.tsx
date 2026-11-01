import React from 'react';
import type { ProjectionRetraitePersonneParams } from '../../../../types/banking.types';
import { NumberField } from '../FormFields';
import { CalcBlock } from './CalcBlock';
import { SalairesPassesEditor } from './SalairesPassesEditor';

interface Props {
  value: ProjectionRetraitePersonneParams;
  onChange: (next: ProjectionRetraitePersonneParams) => void;
}

/** Relevé de carrière et hypothèses de retraite d'une personne (CNAV, Agirc-Arrco, Cipav, PER). */
export const RetraitePersonneFields: React.FC<Props> = ({ value, onChange }) => {
  const num =
    (key: keyof ProjectionRetraitePersonneParams) =>
    (v: number | undefined): void =>
      onChange({ ...value, [key]: v ?? 0 });

  return (
    <>
      <CalcBlock title="Régime général (CNAV)">
        <NumberField
          label="Trimestres validés"
          value={value.trimestresValides}
          onChange={num('trimestresValides')}
        />
        <NumberField
          label="Trimestres requis pour le taux plein"
          value={value.trimestresRequis}
          onChange={num('trimestresRequis')}
        />
        <NumberField
          label="Dernière année du relevé"
          hint="Année civile entièrement couverte par le relevé"
          value={value.anneeReleve}
          onChange={num('anneeReleve')}
        />
        <NumberField
          label="Nombre de meilleures années retenues"
          value={value.nombreMeilleuresAnnees}
          onChange={num('nombreMeilleuresAnnees')}
        />
        <NumberField
          label="Revalorisation des salaires portés au compte"
          percent
          value={value.revalorisationSalaires}
          onChange={num('revalorisationSalaires')}
        />
        <NumberField
          label="Croissance annuelle du PASS"
          percent
          value={value.croissancePass}
          onChange={num('croissancePass')}
        />
      </CalcBlock>
      <SalairesPassesEditor
        value={value.salairesPasses}
        anneeReleve={value.anneeReleve}
        onChange={(salairesPasses) => onChange({ ...value, salairesPasses })}
      />
      <CalcBlock title="Retraite complémentaire et épargne">
        <NumberField
          label="Points Agirc-Arrco acquis"
          value={value.pointsAgircArrco}
          onChange={num('pointsAgircArrco')}
        />
        <NumberField
          label="Valeur de service du point Agirc-Arrco (€)"
          value={value.valeurPointAgircArrco}
          onChange={num('valeurPointAgircArrco')}
        />
        <NumberField
          label="Prix d'achat du point Agirc-Arrco (€)"
          value={value.prixPointAgircArrco}
          onChange={num('prixPointAgircArrco')}
        />
        <NumberField
          label="Points Cipav acquis par an"
          value={value.pointsCipavParAn}
          onChange={num('pointsCipavParAn')}
        />
        <NumberField
          label="Revenu BNC correspondant (€)"
          hint="BNC annuel qui donne les points Cipav par an"
          value={value.bncReferenceCipav}
          onChange={num('bncReferenceCipav')}
        />
        <NumberField
          label="Valeur du point Cipav (€)"
          value={value.valeurPointCipav}
          onChange={num('valeurPointCipav')}
        />
        <NumberField
          label="Rente PER (€ brut par mois)"
          value={value.rentePerMensuelle}
          onChange={num('rentePerMensuelle')}
        />
        <NumberField
          label="Prélèvements sociaux du retraité"
          percent
          value={value.tauxPrelevementsSociaux}
          onChange={num('tauxPrelevementsSociaux')}
        />
      </CalcBlock>
    </>
  );
};
