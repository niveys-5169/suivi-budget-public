import React, { useMemo, useState } from 'react';
import type { ProjectionMoisResultat, ProjectionPersonne } from '../../types/banking.types';
import { Card, EmptyState, SegmentedControl, Section, Stack, Switch, Text } from '../../ui';
import type { Segment } from '../../ui';
import { buildBudgetMensuel } from '../../utils/projection/budgetMensuel';
import type { BudgetMensuelLigne } from '../../utils/projection/budgetMensuel';
import { formatMois } from './projectionFormat';
import { Money, ROW_CLS, Td, Th } from './ProjectionTable';

type Vue = 'periodes' | 'mois';

const VUES: readonly Segment<Vue>[] = [
  { value: 'periodes', label: 'Par période' },
  { value: 'mois', label: 'Mois par mois' },
];

function libellePeriode(l: BudgetMensuelLigne): string {
  return l.nbMois === 1 ? formatMois(l.debut) : `${formatMois(l.debut)} → ${formatMois(l.fin)}`;
}

/**
 * Budget mensuel du foyer du scénario affiché : revenus après PAS → dépenses → capacité
 * d'épargne → patrimoine. Par défaut, les mois consécutifs aux flux identiques sont regroupés
 * et seules les colonnes principales sont affichées.
 */
export const ProjectionBudgetMensuel: React.FC<{
  mois: ProjectionMoisResultat[];
  personnes: ProjectionPersonne[];
}> = ({ mois, personnes }) => {
  const [vue, setVue] = useState<Vue>('periodes');
  const [detail, setDetail] = useState(false);
  const lignes = useMemo(() => buildBudgetMensuel(mois, vue === 'periodes'), [mois, vue]);

  const controles = (
    <Stack direction="row" gap="md" align="center">
      <SegmentedControl segments={VUES} value={vue} onChange={setVue} label="Affichage des mois" />
      <Stack direction="row" gap="sm" align="center">
        <Switch checked={detail} onChange={setDetail} label="Colonnes détaillées" />
        <Text as="span" variant="footnote" tone="secondary">
          Détail
        </Text>
      </Stack>
    </Stack>
  );

  return (
    <Section title="Budget mensuel du foyer" action={controles}>
      <Card padding="none">
        {lignes.length === 0 ? (
          <EmptyState title="Aucun mois" description="L'horizon de projection est vide." />
        ) : (
          <div className="max-h-[70vh] max-w-full overflow-auto">
            <table
              aria-label="Budget mensuel du foyer"
              className="w-full border-collapse text-left [&_td]:px-2 [&_th]:px-2"
            >
              <thead className="sticky top-0 z-10 bg-surface">
                <tr>
                  <Th align="left">{vue === 'periodes' ? 'Période' : 'Mois'}</Th>
                  <Th align="left">Phase</Th>
                  {personnes.map((p) => (
                    <Th key={p.id}>{p.prenom}</Th>
                  ))}
                  <Th>CAF</Th>
                  <Th>Revenus du foyer</Th>
                  {detail && <Th>Crédits</Th>}
                  {detail && <Th>Dépenses courantes</Th>}
                  <Th>Dépenses</Th>
                  <Th>Capacité d&apos;épargne</Th>
                  <Th>Flux exceptionnels</Th>
                  {detail && <Th>Rendements</Th>}
                  <Th>Patrimoine</Th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => {
                  const nouvellePhase = i > 0 && lignes[i - 1]?.phase !== l.phase;
                  return (
                    <tr
                      key={l.debut}
                      className={nouvellePhase ? 'border-t-2 border-label-tertiary' : ROW_CLS}
                    >
                      <th scope="row" className="whitespace-nowrap py-2 text-left font-normal">
                        <Text as="span" variant="callout">
                          {libellePeriode(l)}
                        </Text>
                        {l.nbMois > 1 && (
                          <Text as="span" variant="footnote" tone="tertiary" className="ml-2">
                            {l.nbMois} mois
                          </Text>
                        )}
                      </th>
                      <td className="whitespace-nowrap py-2">
                        <Text
                          as="span"
                          variant="callout"
                          tone={nouvellePhase || i === 0 ? 'primary' : 'tertiary'}
                        >
                          {l.phase}
                        </Text>
                      </td>
                      {personnes.map((p) => (
                        <Td key={p.id}>
                          <Money value={l.revenusParPersonne[p.id] ?? 0} />
                        </Td>
                      ))}
                      <Td>
                        <Money value={l.caf} />
                      </Td>
                      <Td>
                        <Money value={l.revenus} strong />
                      </Td>
                      {detail && (
                        <Td>
                          <Money value={l.creditsFixes} />
                        </Td>
                      )}
                      {detail && (
                        <Td>
                          <Money value={l.depensesCourantes} />
                        </Td>
                      )}
                      <Td>
                        <Money value={l.depenses} />
                      </Td>
                      <Td>
                        <Money value={l.capacite} tone="auto" strong />
                      </Td>
                      <Td>
                        {l.fluxExceptionnels === 0 ? (
                          <Text as="span" variant="callout" tone="tertiary">
                            —
                          </Text>
                        ) : (
                          <Money value={l.fluxExceptionnels} tone="auto" />
                        )}
                      </Td>
                      {detail && (
                        <Td>
                          <Money value={l.rendements} />
                        </Td>
                      )}
                      <Td>
                        <Money value={l.patrimoineFin} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Text variant="footnote" tone="tertiary" className="px-1">
        Montants mensuels en € courants, revenus après prélèvement à la source.
        {vue === 'periodes' &&
          ' Une période regroupe les mois consécutifs aux montants identiques ;'}
        {vue === 'periodes' && ' rendements cumulés sur la période.'} Le patrimoine est celui de fin
        de {vue === 'periodes' ? 'période' : 'mois'}.
      </Text>
    </Section>
  );
};
