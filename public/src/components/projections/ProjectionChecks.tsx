import React from 'react';
import type { ProjectionControle, ProjectionPointAConfirmer } from '../../types/banking.types';
import { Badge, List, ListItem, Section, Text } from '../../ui';

/** Contrôles de cohérence du moteur et points restant à confirmer par l'utilisateur. */
export const ProjectionChecks: React.FC<{
  controles: ProjectionControle[];
  pointsAConfirmer: ProjectionPointAConfirmer[];
}> = ({ controles, pointsAConfirmer }) => (
  <>
    {controles.length > 0 && (
      <Section title="Contrôles">
        <List as="ul">
          {controles.map((c) => (
            <ListItem
              key={c.id}
              as="li"
              leading={
                <Text
                  as="span"
                  variant="headline"
                  tone={c.ok ? 'positive' : 'negative'}
                  aria-hidden="true"
                >
                  {c.ok ? '✓' : '✗'}
                </Text>
              }
              title={<Text variant="callout">{c.libelle}</Text>}
              trailing={
                <Badge tone={c.ok ? 'positive' : 'negative'}>
                  {c.ok ? 'Conforme' : 'En échec'}
                </Badge>
              }
            />
          ))}
        </List>
      </Section>
    )}
    {pointsAConfirmer.length > 0 && (
      <Section title="Points à confirmer">
        <List as="ul">
          {pointsAConfirmer.map((p) => (
            <ListItem
              key={p.id}
              as="li"
              title={<Text variant="callout">{p.libelle}</Text>}
              subtitle={
                p.commentaire ? (
                  <Text variant="footnote" tone="tertiary">
                    {p.commentaire}
                  </Text>
                ) : undefined
              }
            />
          ))}
        </List>
      </Section>
    )}
  </>
);
