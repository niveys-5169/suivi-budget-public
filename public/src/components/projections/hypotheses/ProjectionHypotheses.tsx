import React, { useState } from 'react';
import { Badge, Button, Stack } from '../../../ui';
import { toast } from '../../../lib/toast';
import type { UseProjectionResult } from '../../../hooks/useProjection';
import { AConfirmerEditor } from './AConfirmerEditor';
import { DepensesSection } from './DepensesSection';
import { HorizonFoyerSection } from './HorizonFoyerSection';
import { HypothesesSection } from './HypothesesSection';
import { ImportXlsxButton } from './ImportXlsxButton';
import { MacroSection } from './MacroSection';
import { PatrimoineSection } from './PatrimoineSection';
import { ScenariosSection } from './ScenariosSection';
import { useParamsDraft } from './useParamsDraft';

/** Onglet « Hypothèses » : formulaire à brouillon local, enregistré en un bloc. */
export const ProjectionHypotheses: React.FC<{ projection: UseProjectionResult }> = ({
  projection,
}) => {
  const { params, exists, save, observed, categories, credits } = projection;
  const { draft, setDraft, dirty, reset } = useParamsDraft(params);
  const [saving, setSaving] = useState(false);
  const section = { draft, onChange: setDraft };
  const withCtx = { ...section, ctx: { observed, categories, credits } };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(draft);
      toast.success('Hypothèses enregistrées');
    } catch (err) {
      console.error('Error saving projection params:', err);
      toast.error("Échec de l'enregistrement des hypothèses");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="lg">
      <Stack direction="row" align="center" justify="between" wrap gap="md">
        <ImportXlsxButton base={draft} onApply={setDraft} />
        <Stack direction="row" align="center" wrap gap="md">
          {dirty && <Badge tone="warning">Modifications non enregistrées</Badge>}
          <Button disabled={!dirty} onClick={reset}>
            Annuler les modifications
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!dirty && exists}
            onClick={handleSave}
          >
            Enregistrer
          </Button>
        </Stack>
      </Stack>
      <HypothesesSection title="Horizon et foyer" defaultOpen>
        <HorizonFoyerSection {...section} />
      </HypothesesSection>
      <HypothesesSection title="Scénarios et revenus">
        <ScenariosSection {...withCtx} />
      </HypothesesSection>
      <HypothesesSection title="Dépenses et crédits">
        <DepensesSection {...withCtx} />
      </HypothesesSection>
      <HypothesesSection title="Patrimoine et placements">
        <PatrimoineSection {...withCtx} />
      </HypothesesSection>
      <HypothesesSection title="Macro">
        <MacroSection {...section} />
      </HypothesesSection>
      <HypothesesSection title="Points à confirmer">
        <AConfirmerEditor {...section} />
      </HypothesesSection>
    </Stack>
  );
};
