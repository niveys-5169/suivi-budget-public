import React from 'react';
import { Field, Select, Stack, Switch, Text } from '../../../ui';
import { formatCurrency, formatDecimal } from '../../../lib/formatters';
import type { Credit, ProjectionCreditParam } from '../../../types/banking.types';
import type { EditorContext } from './editorTypes';
import { DateField, NumberField, TextField } from './FormFields';
import { ItemRow } from './ItemRow';

const DEFAULT_LABEL = 'Nouveau crédit';

interface Props {
  credit: ProjectionCreditParam;
  appCredits: Credit[];
  ctx: EditorContext;
  /** Mois proposé pour un remboursement anticipé. */
  defaultMonth: string;
  onChange: (next: ProjectionCreditParam) => void;
  onRemove: () => void;
}

export const CreditRow: React.FC<Props> = ({
  credit,
  appCredits,
  ctx,
  defaultMonth,
  onChange,
  onRemove,
}) => {
  const patch = (p: Partial<ProjectionCreditParam>) => onChange({ ...credit, ...p });
  const observed = credit.creditId ? ctx.observed.credits[credit.creditId] : undefined;

  const link = (creditId: string) => {
    if (creditId === '') return patch({ creditId: undefined, mode: 'manuel' });
    const nom = appCredits.find((c) => c.id === creditId)?.nom;
    const libelle =
      !credit.libelle || credit.libelle === DEFAULT_LABEL
        ? (nom ?? credit.libelle)
        : credit.libelle;
    patch({ creditId, mode: 'auto', libelle });
  };
  const setEarly = (mois: string, frais?: number) =>
    patch({ remboursementAnticipe: { mois, frais } });

  return (
    <Stack gap="md">
      <ItemRow
        removeLabel={`Supprimer le crédit ${credit.libelle || 'sans nom'}`}
        onRemove={onRemove}
      >
        <TextField
          label="Libellé du crédit"
          value={credit.libelle}
          onChange={(libelle) => patch({ libelle })}
        />
        <Field label="Crédit de l'application">
          {(p) => (
            <Select {...p} value={credit.creditId ?? ''} onChange={(e) => link(e.target.value)}>
              <option value="">Saisie manuelle</option>
              {appCredits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </ItemRow>
      {credit.mode === 'auto' ? (
        <Text variant="footnote" tone="tertiary">
          {observed
            ? `Observé : ${formatCurrency(observed.mensualite)} par mois, jusqu'en ${observed.fin}, taux ${formatDecimal(observed.tauxAnnuel)} %`
            : "Non disponible : crédit introuvable dans l'application"}
        </Text>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField
            label="Mensualité (€)"
            value={credit.mensualiteManuelle}
            optional
            onChange={(v) => patch({ mensualiteManuelle: v })}
          />
          <DateField
            kind="month"
            label="Dernier mois payé"
            value={credit.finManuelle}
            onChange={(v) => patch({ finManuelle: v || undefined })}
          />
          <NumberField
            label="Taux annuel (%)"
            value={credit.tauxAnnuelManuel}
            optional
            onChange={(v) => patch({ tauxAnnuelManuel: v })}
          />
        </div>
      )}
      <Stack direction="row" align="center" gap="md">
        <Switch
          label={`Remboursement anticipé de ${credit.libelle || 'ce crédit'}`}
          checked={credit.remboursementAnticipe !== undefined}
          onChange={(on) =>
            patch({ remboursementAnticipe: on ? { mois: defaultMonth } : undefined })
          }
        />
        <Text variant="subhead">Remboursement anticipé</Text>
      </Stack>
      {credit.remboursementAnticipe && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateField
            kind="month"
            label="Mois du remboursement"
            value={credit.remboursementAnticipe.mois}
            onChange={(m) => setEarly(m, credit.remboursementAnticipe?.frais)}
          />
          <NumberField
            label="Frais de remboursement (€)"
            value={credit.remboursementAnticipe.frais}
            optional
            onChange={(f) => setEarly(credit.remboursementAnticipe?.mois ?? defaultMonth, f)}
          />
        </div>
      )}
    </Stack>
  );
};
