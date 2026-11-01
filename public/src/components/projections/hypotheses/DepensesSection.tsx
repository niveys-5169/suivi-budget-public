import React from 'react';
import { Separator, Stack, Text } from '../../../ui';
import { parseCalendarDate } from '../../../utils/date';
import { AutoValueField } from './AutoValueField';
import { CategoryClassEditor } from './CategoryClassEditor';
import { CreditsEditor } from './CreditsEditor';
import { DatedAmountList } from './DatedAmountList';
import type { ContextSectionProps } from './editorTypes';

const day = (iso: string) => parseCalendarDate(iso).toLocaleDateString('fr-FR');

export const DepensesSection: React.FC<ContextSectionProps> = (props) => {
  const { draft, onChange, ctx } = props;
  const { periode } = ctx.observed;
  return (
    <>
      <Stack gap="sm">
        <AutoValueField
          label="Budget mensuel de référence (crédits inclus)"
          value={draft.depenses.budgetReference}
          observed={ctx.observed.budgetReference}
          onChange={(budgetReference) =>
            onChange({ ...draft, depenses: { ...draft.depenses, budgetReference } })
          }
        />
        {periode && (
          <Text variant="footnote" tone="tertiary">
            {`Période observée : du ${day(periode.debut)} au ${day(periode.fin)}`}
          </Text>
        )}
      </Stack>
      <Separator />
      <CategoryClassEditor {...props} />
      <Separator />
      <CreditsEditor {...props} />
      <Separator />
      <DatedAmountList
        title="Dépenses exceptionnelles"
        items={draft.depenses.exceptionnelles}
        defaultMonth={draft.horizon.debut}
        addLabel="Ajouter une dépense exceptionnelle"
        emptyHint="Aucune dépense exceptionnelle prévue (travaux, voyage, véhicule…)."
        onChange={(exceptionnelles) =>
          onChange({ ...draft, depenses: { ...draft.depenses, exceptionnelles } })
        }
      />
    </>
  );
};
