import React from 'react';
import { Stack, Text } from '../../ui';
import { useDocumentAudit } from '../../hooks/useAuditLog';
import { describeEntry, formatAuditDate } from '../../utils/auditLog';

const SHOWN = 3;

/** Rappel, dans la fiche d'une transaction, de ses dernières modifications. */
export const TransactionAuditTrail: React.FC<{ txId: string }> = ({ txId }) => {
  const entries = useDocumentAudit(`transactions/${txId}`).slice(0, SHOWN);
  if (entries.length === 0) return null;

  return (
    <Stack gap="xs">
      <Text variant="overline" tone="secondary">
        Dernières modifications
      </Text>
      {entries.map((entry) => (
        <div key={entry.id}>
          <Text variant="footnote">{describeEntry(entry)}</Text>
          <Text variant="footnote" tone="tertiary">
            {entry.byEmail} · {formatAuditDate(entry.at)}
          </Text>
        </div>
      ))}
    </Stack>
  );
};
