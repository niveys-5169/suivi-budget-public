import React from 'react';
import { Trash2 } from 'lucide-react';
import { IconButton, Stack } from '../../../ui';

interface Props {
  /** Nom accessible du bouton de suppression (ex. « Supprimer la phase Retraite »). */
  removeLabel: string;
  onRemove: () => void;
  children: React.ReactNode;
}

/** Ligne éditable d'une liste : champs en grille et bouton de suppression. */
export const ItemRow: React.FC<Props> = ({ removeLabel, onRemove, children }) => (
  <Stack direction="row" align="start" gap="md">
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
    <IconButton label={removeLabel} variant="plain" onClick={onRemove}>
      <Trash2 size={20} aria-hidden="true" />
    </IconButton>
  </Stack>
);
