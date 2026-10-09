import React from 'react';
import type { AccountBalance } from '../../types/banking.types';
import { Text } from '../../ui';
import { formatCurrency } from '../../lib/formatters';
import { bankDateMillis } from '../../utils/bankDateMillis';
import { getSyncSourceLabel } from '../../constants/syncSource';

const LABEL = {
  concordant: 'Soldes reçus concordants',
  explained: 'Décalage expliqué (provisoire)',
  waiting: 'Vérification en attente',
  discrepancy: 'Écart à vérifier',
};
export const BankBalanceStatus: React.FC<{ balance: AccountBalance }> = ({ balance }) => {
  const control = balance.crossControl;
  if (!control) return null;
  return (
    <div className="space-y-2">
      <Text variant="caption" tone="secondary">
        {getSyncSourceLabel(balance.source)} · Reçu le{' '}
        {bankDateMillis(balance.source_timestamp)
          ? new Date(bankDateMillis(balance.source_timestamp)).toLocaleString('fr-FR')
          : 'date inconnue'}
      </Text>
      <Text variant="caption">{LABEL[control.status]}</Text>
      <Text variant="caption" tone="secondary">
        Solde{' '}
        {['ITBD', 'CLBD', 'booked'].includes(balance.balanceType ?? '')
          ? 'comptable'
          : ['ITAV', 'CLAV'].includes(balance.balanceType ?? '')
            ? 'disponible'
            : 'de nature inconnue'}{' '}
        · {balance.bankDate ? `Date bancaire : ${balance.bankDate}` : 'Date bancaire inconnue'}
      </Text>
      <Text variant="caption" tone="secondary">
        Enable Banking :{' '}
        {control.enableBalance == null ? '—' : formatCurrency(control.enableBalance)} · Linxo :{' '}
        {control.linxoBalance == null ? '—' : formatCurrency(control.linxoBalance)}
      </Text>
      {control.linxoBalance != null && (
        <Text variant="caption" tone="secondary">
          Linxo · Email reçu le{' '}
          {bankDateMillis(control.linxoReceivedAt)
            ? new Date(bankDateMillis(control.linxoReceivedAt)).toLocaleString('fr-FR')
            : 'date inconnue'}
        </Text>
      )}
      {control.reason && (
        <Text variant="caption" tone="secondary">
          {control.reason}
        </Text>
      )}
      {control.difference != null && (
        <Text variant="caption">Différence : {formatCurrency(control.difference)}</Text>
      )}
      {(control.movements ?? []).map((movement) => (
        <Text key={movement.id} variant="caption">
          {movement.date} · {movement.libelle} · {formatCurrency(movement.montant)}
        </Text>
      ))}
    </div>
  );
};
