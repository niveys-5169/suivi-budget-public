import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { useForm, useWatch, Controller, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useIntl } from 'react-intl';
import { usePlacements, type Placement } from '../../hooks/usePlacements';
import { useCredits } from '../../hooks/useCredits';
import { propertyFormSchema, type PropertyFormValues } from '../../lib/schemas/forms';
import { buildPropertyPayload } from '../../utils/property';
import { confirm } from '../../lib/confirm';
import { Modal } from '../shared/Modal';
import { MoneyInput } from '../shared/MoneyInput';
import { Button, Field, Input, Select, Stack, Switch, Text } from '../../ui';

interface PropertyFormModalProps {
  /** Bien existant (édition) ; absent pour une création. */
  placement?: Placement;
  onClose: () => void;
  onSave: () => void;
}

const OWNERS = ['Nicolas', 'Sienna', 'Romane', 'Gwen'];
const DPE_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

const MONEY_INPUT_CLS =
  'w-full min-h-11 rounded-md border border-transparent bg-raised px-4 text-base text-label transition-colors focus:border-gold focus:outline-none aria-[invalid=true]:border-negative';

const buildDefaults = (placement: Placement | undefined): PropertyFormValues => {
  const bien = placement?.bien;
  return {
    nom: placement?.nom ?? '',
    owner: placement?.owner || 'Nicolas',
    adresse: bien?.adresse ?? '',
    codePostal: bien?.codePostal ?? '',
    ville: bien?.ville ?? '',
    nature: bien?.nature ?? 'appartement',
    surface: bien?.surface ?? 0,
    pieces: bien?.pieces ?? 3,
    sallesDeBain: bien?.sallesDeBain ?? null,
    terrain: bien?.terrain ?? null,
    etage: bien?.etage ?? null,
    nbEtages: bien?.nbEtages ?? null,
    ascenseur: bien?.ascenseur ?? false,
    garages: bien?.garages ?? 0,
    parkings: bien?.parkings ?? 0,
    jardin: bien?.jardin ?? false,
    terrasse: bien?.terrasse ?? false,
    balcon: bien?.balcon ?? false,
    dpe: bien?.dpe ?? '',
    anneeConstruction: bien?.anneeConstruction ?? null,
    prixAchat: bien?.prixAchat ?? null,
    fraisNotaire: bien?.fraisNotaire ?? null,
    fraisAgence: bien?.fraisAgence ?? null,
    travaux: bien?.travaux ?? null,
    modeValorisation: placement?.modeValorisation ?? 'estime',
    montant: placement?.modeValorisation === 'manuel' ? placement.montant : null,
    creditId: placement?.creditId ?? '',
  };
};

type NumericField =
  | 'surface'
  | 'pieces'
  | 'sallesDeBain'
  | 'terrain'
  | 'etage'
  | 'nbEtages'
  | 'garages'
  | 'parkings'
  | 'anneeConstruction'
  | 'prixAchat'
  | 'fraisNotaire'
  | 'fraisAgence'
  | 'travaux'
  | 'montant';

interface NumberFieldProps {
  control: Control<PropertyFormValues>;
  name: NumericField;
  label: string;
  error?: string;
  /** Champ facultatif : vide = `null`. Sinon vide = 0. */
  optional?: boolean;
  hint?: string;
}

/** Saisie numérique (virgule acceptée) liée au formulaire. */
const NumberField: React.FC<NumberFieldProps> = ({
  control,
  name,
  label,
  error,
  optional,
  hint,
}) => (
  <Field label={label} error={error} hint={hint}>
    {(p) => (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <MoneyInput
            {...p}
            value={optional ? field.value : field.value || null}
            onChange={(v) => field.onChange(optional ? v : (v ?? 0))}
            onBlur={field.onBlur}
            className={MONEY_INPUT_CLS}
          />
        )}
      />
    )}
  </Field>
);

interface ToggleFieldProps {
  control: Control<PropertyFormValues>;
  name: 'ascenseur' | 'jardin' | 'terrasse' | 'balcon';
  label: string;
}

const ToggleField: React.FC<ToggleFieldProps> = ({ control, name, label }) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <Stack direction="row" align="center" justify="between" className="min-h-11">
        <Text variant="callout" tone="secondary">
          {label}
        </Text>
        <Switch checked={field.value} onChange={field.onChange} label={label} />
      </Stack>
    )}
  />
);

/** Création / édition d'un bien immobilier (document `placements` de type `immobilier`). */
export const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  placement,
  onClose,
  onSave,
}) => {
  const { formatMessage: t } = useIntl();
  const { addPlacement, updatePlacement, deletePlacement } = usePlacements();
  const { credits } = useCredits();
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: buildDefaults(placement),
  });

  const nature = useWatch({ control, name: 'nature' });
  const mode = useWatch({ control, name: 'modeValorisation' });

  const onSubmit = async (values: PropertyFormValues) => {
    const payload = buildPropertyPayload(values, {
      montant: placement?.montant,
      bien: placement?.bien,
    });
    try {
      if (placement?.id) {
        await updatePlacement(placement.id, payload);
      } else {
        await addPlacement(payload);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving property:', err);
    }
  };

  const handleDelete = async () => {
    if (!placement?.id) return;
    if (!(await confirm({ message: t({ id: 'property.form.delete.confirm' }), danger: true })))
      return;
    setDeleting(true);
    try {
      await deletePlacement(placement.id);
      onSave();
      onClose();
    } catch (err) {
      console.error('Error deleting property:', err);
    } finally {
      setDeleting(false);
    }
  };

  const title = placement
    ? t({ id: 'property.form.title.edit' })
    : t({ id: 'property.form.title.new' });

  const headerActions = (
    <Button
      type="submit"
      form="property-form"
      variant="primary"
      size="sm"
      loading={isSubmitting}
      disabled={deleting}
    >
      {!isSubmitting && <Save size={14} aria-hidden="true" />}
      {isSubmitting ? t({ id: 'state.saving' }) : t({ id: 'action.save' })}
    </Button>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={title}
      headerActions={headerActions}
      variant="centered"
    >
      <form
        id="property-form"
        onSubmit={handleSubmit(onSubmit)}
        aria-label={title}
        noValidate
        className="p-6"
      >
        <Stack gap="xl">
          <Stack gap="md">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t({ id: 'property.form.name' })} error={errors.nom?.message}>
                {(p) => <Input {...p} type="text" {...register('nom')} />}
              </Field>
              <Field label={t({ id: 'property.form.owner' })} error={errors.owner?.message}>
                {(p) => (
                  <Select {...p} {...register('owner')}>
                    {OWNERS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Stack>

          <Stack gap="md">
            <Text variant="headline">{t({ id: 'property.form.section.address' })}</Text>
            <Field label={t({ id: 'property.form.address' })} error={errors.adresse?.message}>
              {(p) => (
                <Input {...p} type="text" autoComplete="street-address" {...register('adresse')} />
              )}
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t({ id: 'property.form.postalCode' })}
                error={errors.codePostal?.message}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    {...register('codePostal')}
                  />
                )}
              </Field>
              <Field label={t({ id: 'property.form.city' })} error={errors.ville?.message}>
                {(p) => <Input {...p} type="text" {...register('ville')} />}
              </Field>
            </div>
          </Stack>

          <Stack gap="md">
            <Text variant="headline">{t({ id: 'property.form.section.features' })}</Text>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t({ id: 'property.form.nature' })} error={errors.nature?.message}>
                {(p) => (
                  <Select {...p} {...register('nature')}>
                    <option value="appartement">
                      {t({ id: 'property.form.nature.appartement' })}
                    </option>
                    <option value="maison">{t({ id: 'property.form.nature.maison' })}</option>
                  </Select>
                )}
              </Field>
              <NumberField
                control={control}
                name="surface"
                label={t({ id: 'property.form.surface' })}
                error={errors.surface?.message}
              />
              <NumberField
                control={control}
                name="pieces"
                label={t({ id: 'property.form.rooms' })}
                error={errors.pieces?.message}
              />
              <NumberField
                control={control}
                name="sallesDeBain"
                label={t({ id: 'property.form.bathrooms' })}
                error={errors.sallesDeBain?.message}
                optional
              />
              {nature === 'maison' ? (
                <NumberField
                  control={control}
                  name="terrain"
                  label={t({ id: 'property.form.land' })}
                  error={errors.terrain?.message}
                  optional
                />
              ) : (
                <>
                  <NumberField
                    control={control}
                    name="etage"
                    label={t({ id: 'property.form.floor' })}
                    error={errors.etage?.message}
                    optional
                  />
                  <NumberField
                    control={control}
                    name="nbEtages"
                    label={t({ id: 'property.form.floors' })}
                    error={errors.nbEtages?.message}
                    optional
                  />
                </>
              )}
              <NumberField
                control={control}
                name="garages"
                label={t({ id: 'property.form.garages' })}
                error={errors.garages?.message}
              />
              <NumberField
                control={control}
                name="parkings"
                label={t({ id: 'property.form.parkings' })}
                error={errors.parkings?.message}
              />
              <Field label={t({ id: 'property.form.dpe' })} error={errors.dpe?.message}>
                {(p) => (
                  <Select {...p} {...register('dpe')}>
                    <option value="">{t({ id: 'property.form.dpe.none' })}</option>
                    {DPE_CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <NumberField
                control={control}
                name="anneeConstruction"
                label={t({ id: 'property.form.year' })}
                error={errors.anneeConstruction?.message}
                optional
              />
            </div>
            <Stack gap="none">
              {nature === 'appartement' && (
                <ToggleField
                  control={control}
                  name="ascenseur"
                  label={t({ id: 'property.form.elevator' })}
                />
              )}
              <ToggleField
                control={control}
                name="jardin"
                label={t({ id: 'property.form.garden' })}
              />
              <ToggleField
                control={control}
                name="terrasse"
                label={t({ id: 'property.form.terrace' })}
              />
              <ToggleField
                control={control}
                name="balcon"
                label={t({ id: 'property.form.balcony' })}
              />
            </Stack>
          </Stack>

          <Stack gap="md">
            <Text variant="headline">{t({ id: 'property.form.section.purchase' })}</Text>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                control={control}
                name="prixAchat"
                label={t({ id: 'property.form.price' })}
                error={errors.prixAchat?.message}
                optional
              />
              <NumberField
                control={control}
                name="fraisNotaire"
                label={t({ id: 'property.form.notaryFees' })}
                error={errors.fraisNotaire?.message}
                optional
              />
              <NumberField
                control={control}
                name="fraisAgence"
                label={t({ id: 'property.form.agencyFees' })}
                error={errors.fraisAgence?.message}
                optional
              />
              <NumberField
                control={control}
                name="travaux"
                label={t({ id: 'property.form.works' })}
                error={errors.travaux?.message}
                optional
              />
            </div>
          </Stack>

          <Stack gap="md">
            <Text variant="headline">{t({ id: 'property.form.section.valuation' })}</Text>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t({ id: 'property.form.mode' })}
                error={errors.modeValorisation?.message}
                hint={mode === 'estime' ? t({ id: 'property.form.mode.hint' }) : undefined}
              >
                {(p) => (
                  <Select {...p} {...register('modeValorisation')}>
                    <option value="estime">{t({ id: 'property.form.mode.estime' })}</option>
                    <option value="manuel">{t({ id: 'property.form.mode.manuel' })}</option>
                  </Select>
                )}
              </Field>
              {mode === 'manuel' && (
                <NumberField
                  control={control}
                  name="montant"
                  label={t({ id: 'property.form.amount' })}
                  error={errors.montant?.message}
                  optional
                />
              )}
              <Field
                label={t({ id: 'property.form.credit' })}
                hint={t({ id: 'property.form.credit.hint' })}
              >
                {(p) => (
                  <Select {...p} {...register('creditId')}>
                    <option value="">{t({ id: 'property.form.credit.none' })}</option>
                    {credits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Stack>

          <Stack direction="row" gap="md" justify="end">
            {placement?.id && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting || deleting}
                className="mr-auto"
              >
                {t({ id: 'action.delete' })}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              {t({ id: 'action.cancel' })}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Modal>
  );
};
