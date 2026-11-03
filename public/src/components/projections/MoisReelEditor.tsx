import React, { useState } from 'react';
import type {
  ProjectionMoisReel,
  ProjectionMonth,
  ProjectionPersonne,
} from '../../types/banking.types';
import { Button, Modal, Sheet, Stack, Text } from '../../ui';
import { NumberField } from './hypotheses/FormFields';
import { formatEuros, formatMois } from './projectionFormat';

type Champ = Exclude<keyof ProjectionMoisReel, 'revenusParPersonne'>;
type Brouillon = Omit<ProjectionMoisReel, 'revenusParPersonne'> & {
  revenusParPersonne?: Record<string, number | undefined>;
};

const CHAMPS: { key: Champ; label: string }[] = [
  { key: 'caf', label: 'CAF' },
  { key: 'autresRevenus', label: 'Autres revenus' },
  { key: 'depenses', label: 'Dépenses' },
  { key: 'fluxExceptionnels', label: 'Flux exceptionnels (négatif = dépense)' },
  { key: 'epargneNette', label: 'Épargne nette (versements − retraits)' },
  { key: 'patrimoineFin', label: 'Patrimoine réel fin de mois (hors PER et immobilier)' },
];

/** Retire les champs vides ; undefined si plus rien n'est saisi. */
function nettoyer(saisie: Brouillon): ProjectionMoisReel | undefined {
  const revenus: Record<string, number> = {};
  for (const [id, v] of Object.entries(saisie.revenusParPersonne ?? {}))
    if (v !== undefined) revenus[id] = v;
  const result: ProjectionMoisReel = {};
  if (Object.keys(revenus).length > 0) result.revenusParPersonne = revenus;
  for (const { key } of CHAMPS) if (saisie[key] !== undefined) result[key] = saisie[key];
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Saisie manuelle des montants d'un mois. Un champ vide reprend le montant relevé dans les
 * transactions, ou à défaut le montant théorique.
 */
export const MoisReelEditor: React.FC<{
  mois: ProjectionMonth;
  personnes: ProjectionPersonne[];
  releve: ProjectionMoisReel | undefined;
  saisie: ProjectionMoisReel | undefined;
  onSave: (saisie: ProjectionMoisReel | undefined) => void;
  onClose: () => void;
}> = ({ mois, personnes, releve, saisie, onSave, onClose }) => {
  const [draft, setDraft] = useState<Brouillon>(saisie ?? {});

  const hint = (valeur: number | undefined) =>
    valeur === undefined
      ? 'Vide : montant théorique'
      : `Vide : montant relevé (${formatEuros(Math.round(valeur))})`;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Montants de ${formatMois(mois)}`}
      subtitle="Montants mensuels réels, en euros, revenus après prélèvement à la source."
    >
      <Sheet.Body>
        <Stack gap="md">
          {personnes.map((p) => (
            <NumberField
              key={p.id}
              optional
              label={`Revenus de ${p.prenom}`}
              value={draft.revenusParPersonne?.[p.id]}
              hint={hint(releve?.revenusParPersonne?.[p.id])}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  revenusParPersonne: { ...d.revenusParPersonne, [p.id]: v },
                }))
              }
            />
          ))}
          {CHAMPS.map(({ key, label }) => (
            <NumberField
              key={key}
              optional
              label={label}
              value={draft[key]}
              hint={hint(releve?.[key])}
              onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
            />
          ))}
          {!releve && (
            <Text variant="footnote" tone="tertiary">
              Aucun montant relevé pour ce mois (mois à venir ou sans transaction).
            </Text>
          )}
        </Stack>
      </Sheet.Body>
      <Sheet.Footer>
        {saisie && (
          <Button variant="destructive" onClick={() => onSave(undefined)}>
            Effacer la saisie
          </Button>
        )}
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="primary" onClick={() => onSave(nettoyer(draft))}>
          Enregistrer
        </Button>
      </Sheet.Footer>
    </Modal>
  );
};
