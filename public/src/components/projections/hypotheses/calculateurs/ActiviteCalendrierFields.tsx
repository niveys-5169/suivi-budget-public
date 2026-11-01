import React from 'react';
import type { ProjectionActiviteParams } from '../../../../types/banking.types';
import { DateField, NumberField } from '../FormFields';
import { CalcBlock } from './CalcBlock';
import { patchOf } from './calcUtils';

interface Props {
  value: ProjectionActiviteParams;
  onChange: (next: ProjectionActiviteParams) => void;
}

/** Personne 1 : naissance, paie validée et calendrier de la rupture au reclassement. */
export const ActiviteCalendrierFields: React.FC<Props> = ({ value, onChange }) => {
  const setP1 = patchOf(value, 'personne1', onChange);
  const setPaie = patchOf(value, 'paie', onChange);
  const setCal = patchOf(value, 'calendrier', onChange);
  const { personne1, paie, calendrier } = value;

  return (
    <>
      <CalcBlock title="Personne 1 et paie">
        <DateField
          kind="date"
          label="Date de naissance (personne 1)"
          value={personne1.dateNaissance}
          onChange={(dateNaissance) => setP1({ dateNaissance })}
        />
        <NumberField
          label="Âge de départ à la retraite"
          value={personne1.ageDepartRetraite}
          onChange={(v) => setP1({ ageDepartRetraite: v ?? 0 })}
        />
        <NumberField
          label="Net avant PAS d'un mois normal (€)"
          value={paie.netAvantPas}
          onChange={(v) => setPaie({ netAvantPas: v ?? 0 })}
        />
        <NumberField
          label="Net imposable d'un mois normal (€)"
          value={paie.netImposable}
          onChange={(v) => setPaie({ netImposable: v ?? 0 })}
        />
        <NumberField
          label="Nombre de mois payés par an"
          hint="La paie est lissée sur 12 mois"
          value={paie.moisPayesParAn}
          onChange={(v) => setPaie({ moisPayesParAn: v ?? 0 })}
        />
        <NumberField
          label="Ratio net imposable / net versé des revenus de remplacement"
          value={paie.ratioImposableRemplacement}
          onChange={(v) => setPaie({ ratioImposableRemplacement: v ?? 0 })}
        />
      </CalcBlock>
      <CalcBlock title="Calendrier de la rupture et du reclassement">
        <DateField
          kind="date"
          label="Date de notification"
          value={calendrier.dateNotification}
          onChange={(dateNotification) => setCal({ dateNotification })}
        />
        <NumberField
          label="Délai de réflexion (jours)"
          value={calendrier.delaiReflexionJours}
          onChange={(v) => setCal({ delaiReflexionJours: v ?? 0 })}
        />
        <NumberField
          label="Durée du préavis (mois)"
          hint="Le préavis court dans le congé de reclassement"
          value={calendrier.dureePreavisMois}
          onChange={(v) => setCal({ dureePreavisMois: v ?? 0 })}
        />
        <NumberField
          label="Durée du congé de reclassement (mois)"
          value={calendrier.dureeCongeMois}
          onChange={(v) => setCal({ dureeCongeMois: v ?? 0 })}
        />
        <DateField
          kind="date"
          label="Début en association"
          value={calendrier.debutAssociation}
          onChange={(debutAssociation) => setCal({ debutAssociation })}
        />
        <DateField
          kind="date"
          label="Bascule en libéral"
          hint="Scénarios avec des mesures cibles"
          value={calendrier.dateBasculeLiberal}
          onChange={(dateBasculeLiberal) => setCal({ dateBasculeLiberal })}
        />
      </CalcBlock>
    </>
  );
};
