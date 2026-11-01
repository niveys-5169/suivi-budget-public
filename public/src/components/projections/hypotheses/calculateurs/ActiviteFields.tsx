import React from 'react';
import { Separator } from '../../../../ui';
import type { ProjectionActiviteParams, ProjectionParams } from '../../../../types/banking.types';
import { ActiviteCalendrierFields } from './ActiviteCalendrierFields';
import { ActiviteFoyerFields } from './ActiviteFoyerFields';
import { ActiviteIndemnitesFields } from './ActiviteIndemnitesFields';
import { ActiviteLiberalFields } from './ActiviteLiberalFields';
import { MesuresCiblesFields } from './MesuresCiblesFields';

interface Props {
  value: ProjectionActiviteParams;
  draft: ProjectionParams;
  onChange: (next: ProjectionActiviteParams) => void;
}

/** Paramètres du calculateur d'activité : rupture, reclassement, ARE, salariat, libéral et foyer. */
export const ActiviteFields: React.FC<Props> = ({ value, draft, onChange }) => (
  <>
    <ActiviteCalendrierFields value={value} onChange={onChange} />
    <ActiviteIndemnitesFields value={value} onChange={onChange} />
    <Separator />
    <MesuresCiblesFields value={value} scenarios={draft.scenarios} onChange={onChange} />
    <ActiviteLiberalFields value={value} onChange={onChange} />
    <Separator />
    <ActiviteFoyerFields value={value} draft={draft} onChange={onChange} />
  </>
);
