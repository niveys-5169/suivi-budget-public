import React from 'react';
import { CircleDashed, CheckCircle2, ChevronRight } from 'lucide-react';
import { Badge, Card, Stack, Text, Tile } from '../../../ui';

interface Props {
  count: number;
  onClick: () => void;
}

/**
 * Raccourci vers le pointage.
 *
 * Cas d'école du coin cassé : la carte valait `rounded-[2.4rem]` (38 px) avec
 * un padding `p-7` (28 px, hors grille), et contenait une tuile de 48 px au
 * rayon `rounded-[1.6rem]` (26 px). Le rayon disponible dans ce coin n'était
 * que de 10 px — la tuile débordait visiblement son angle.
 *
 * Désormais : carte 12 px, padding 16 px, tuile 8 px, et la tuile ne touche
 * plus le coin.
 */
export const AurumUnpointedCard: React.FC<Props> = ({ count, onClick }) => {
  const allPointed = count === 0;

  const body = (
    <Stack direction="row" gap="md" align="center">
      <Tile tone={allPointed ? 'neutral' : 'accent'}>
        {allPointed ? (
          <CheckCircle2 size={18} className="text-positive" />
        ) : (
          <CircleDashed size={18} />
        )}
      </Tile>
      <Stack gap="none" className="min-w-0 flex-1">
        <Text variant="headline">{allPointed ? 'Tout est pointé' : 'À pointer'}</Text>
        <Text variant="footnote" tone="tertiary">
          {allPointed
            ? 'Aucune opération en attente'
            : `${count} opération${count > 1 ? 's' : ''} en attente de vérification`}
        </Text>
      </Stack>
      {allPointed ? (
        <Badge tone="positive" dot>
          À jour
        </Badge>
      ) : (
        <>
          <Badge tone="accent">{count}</Badge>
          <ChevronRight size={18} className="text-label-tertiary" aria-hidden="true" />
        </>
      )}
    </Stack>
  );

  if (allPointed) {
    return <Card>{body}</Card>;
  }

  return (
    <Card
      as="button"
      interactive
      onClick={onClick}
      className="w-full"
      aria-label={`${count} transactions à pointer`}
    >
      {body}
    </Card>
  );
};
