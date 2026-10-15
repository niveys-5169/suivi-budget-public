import React from 'react';
import { useIntl } from 'react-intl';
import { Badge, Button } from '../../ui';
import { useBankingData } from '../../hooks/useBankingData';
import { directlyConfirmable, useBankConfirm } from '../../hooks/useBankConfirm';
import type { Transaction } from '../../types/banking.types';

export const BankTransactionBadge: React.FC<{
  transaction: Pick<Transaction, 'linxoStatus' | 'bankObservationIds'>;
}> = ({ transaction }) => {
  const { formatMessage: t } = useIntl();
  const { reports } = useBankingData();
  const { busy, confirmAll } = useBankConfirm();
  if (transaction.linxoStatus !== 'waiting' && transaction.linxoStatus !== 'overdue') return null;
  const suggestion = directlyConfirmable(
    reports.find((report) => report.id === 'reconciliation')?.suggestions ?? [],
  ).find((item) => transaction.bankObservationIds?.includes(item.enableObservationId));
  return (
    <>
      <Badge tone="warning">
        {t({ id: transaction.linxoStatus === 'overdue' ? 'banking.missing' : 'banking.waiting' })}
      </Badge>
      {suggestion && (
        <Button
          disabled={busy}
          variant="plain"
          onClick={(event) => {
            event.stopPropagation();
            void confirmAll([suggestion]);
          }}
        >
          Confirmer
        </Button>
      )}
    </>
  );
};
