import React from 'react';
import type { BankObservationDetails } from '../../types/banking.types';
import { bankDateMillis } from '../../utils/bankDateMillis';
import { Text } from '../../ui';

export const BankObservationDates: React.FC<{ details: BankObservationDetails }> = ({
  details,
}) => {
  const received = (date: BankObservationDetails['enableReceivedAt']) => {
    const time = bankDateMillis(date);
    return time ? new Date(time).toLocaleString('fr-FR') : 'date inconnue';
  };
  if (!details.enableDate) return null;
  return (
    <div>
      <Text tone="secondary" variant="caption">
        Enable Banking · opération du {details.enableDate} · reçue le{' '}
        {received(details.enableReceivedAt)}
      </Text>
      {details.linxoDate && (
        <Text tone="secondary" variant="caption">
          Notification Linxo · opération du {details.linxoDate} · reçue le{' '}
          {received(details.linxoReceivedAt)}
        </Text>
      )}
    </div>
  );
};
