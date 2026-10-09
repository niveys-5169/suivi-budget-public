import React from 'react';
import { useIntl } from 'react-intl';
import { Badge } from '../../ui';
import type { Transaction } from '../../types/banking.types';

export const BankTransactionBadge: React.FC<{ transaction: Pick<Transaction, 'linxoStatus'> }> = ({
  transaction,
}) => {
  const { formatMessage: t } = useIntl();
  return transaction.linxoStatus === 'waiting' || transaction.linxoStatus === 'overdue' ? (
    <Badge tone="warning">
      {t({ id: transaction.linxoStatus === 'overdue' ? 'banking.missing' : 'banking.waiting' })}
    </Badge>
  ) : null;
};
