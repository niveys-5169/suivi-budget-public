import React from 'react';
import { Text } from '../../../../ui';
import type { ProjectionParams } from '../../../../types/banking.types';
import { personnesCalculees } from '../../../../utils/projection/calculateurs/personnesCalculees';

/** Mention affichée au-dessus des phases quand les calculateurs remplacent les revenus saisis. */
export const CalculatedIncomeNotice: React.FC<{ params: ProjectionParams }> = ({ params }) => {
  const noms = personnesCalculees(params).map((p) => p.prenom || 'Sans nom');
  if (noms.length === 0) return null;
  return (
    <Text variant="subhead" tone="warning" role="note">
      {`Revenus calculés — les phases ci-dessous ne sont pas utilisées pour ${noms.join(' et ')}`}
    </Text>
  );
};
