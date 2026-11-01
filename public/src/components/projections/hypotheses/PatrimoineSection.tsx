import React from 'react';
import { Separator, Stack, Switch, Text } from '../../../ui';
import { AutoValueField } from './AutoValueField';
import { MONTH_NAMES } from './constants';
import { DatedAmountList } from './DatedAmountList';
import type { ContextSectionProps } from './editorTypes';
import { DateField, NumberField } from './FormFields';
import { MonthSelect } from './MonthSelect';

export const PatrimoineSection: React.FC<ContextSectionProps> = ({ draft, onChange, ctx }) => {
  const { capital, macro } = draft;
  const setCapital = (patch: Partial<typeof capital>) =>
    onChange({ ...draft, capital: { ...capital, ...patch } });
  const setMacro = (patch: Partial<typeof macro>) =>
    onChange({ ...draft, macro: { ...macro, ...patch } });
  const { abondement } = capital;
  const setAbondement = (patch: Partial<NonNullable<typeof abondement>>) =>
    abondement && setCapital({ abondement: { ...abondement, ...patch } });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NumberField
          label="Rendement du capital"
          percent
          value={macro.rendementCapital}
          onChange={(v) => setMacro({ rendementCapital: v ?? 0 })}
        />
        <NumberField
          label="Rendement du patrimoine hors PER"
          percent
          value={macro.rendementPatrimoine}
          onChange={(v) => setMacro({ rendementPatrimoine: v ?? 0 })}
        />
        <NumberField
          label="Capital initial (€)"
          value={capital.capitalInitial}
          onChange={(v) => setCapital({ capitalInitial: v ?? 0 })}
        />
      </div>
      <AutoValueField
        label="Patrimoine de départ hors PER"
        value={capital.patrimoineDepart}
        observed={ctx.observed.patrimoineHorsPer}
        onChange={(patrimoineDepart) => setCapital({ patrimoineDepart })}
      />
      <Separator />
      <DatedAmountList
        title="Encaissements ponctuels"
        items={capital.encaissements}
        defaultMonth={draft.horizon.debut}
        addLabel="Ajouter un encaissement"
        emptyHint="Aucun encaissement prévu (indemnités, héritage, vente…)."
        onChange={(encaissements) => setCapital({ encaissements })}
      />
      <Separator />
      <Stack gap="md">
        <Stack direction="row" align="center" gap="md">
          <Switch
            label="Abondement annuel"
            checked={abondement !== undefined}
            onChange={(on) =>
              setCapital({ abondement: on ? { montantAnnuel: 0, mois: 1 } : undefined })
            }
          />
          <Text variant="headline">Abondement annuel</Text>
        </Stack>
        {abondement && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label="Montant annuel (€)"
              value={abondement.montantAnnuel}
              onChange={(v) => setAbondement({ montantAnnuel: v ?? 0 })}
            />
            <MonthSelect
              label="Mois de versement"
              names={MONTH_NAMES}
              value={abondement.mois}
              onChange={(mois) => setAbondement({ mois })}
            />
            <DateField
              kind="month"
              label="Dernier mois d'abondement"
              value={abondement.finMois}
              onChange={(v) => setAbondement({ finMois: v || undefined })}
            />
          </div>
        )}
      </Stack>
    </>
  );
};
