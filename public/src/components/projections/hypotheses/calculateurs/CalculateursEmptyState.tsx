import React from 'react';
import { EmptyState } from '../../../../ui';

/** État vide : aucun paramètre de calculateur n'est encore enregistré. */
export const CalculateursEmptyState: React.FC<{ onInit: () => void }> = ({ onInit }) => (
  <EmptyState
    title="Aucun paramètre de calculateur"
    description="Les calculateurs déduisent vos revenus d'activité, votre impôt et vos retraites de paramètres détaillés. Initialisez des valeurs génériques à compléter, ou importez votre classeur de simulation : l'import les remplit."
    action={{ label: 'Initialiser les paramètres', onClick: onInit }}
  />
);
