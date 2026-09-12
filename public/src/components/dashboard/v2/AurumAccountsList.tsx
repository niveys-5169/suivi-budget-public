import React from 'react';
import { BankLogo } from '../../shared/BankLogo';
import { getSyncSourceLabel } from '../../../constants/syncSource';
import { formatRelativeTime, toMillis } from '../../../utils/firestoreDate';
import { Amount, List, ListItem, Stack, Text } from '../../../ui';
import type { FirestoreDateLike } from '../../../types/banking.types';

interface Account {
  id: string;
  name: string;
  bankName?: string;
  balance: number;
  status?: string;
  owner?: string;
  source?: string;
  syncedAt?: FirestoreDateLike;
}

/** Provenance et fraîcheur de la donnée. Rien si la source est inconnue. */
const syncLabel = (source?: string, syncedAt?: FirestoreDateLike): string | null => {
  const label = getSyncSourceLabel(source);
  if (!label) return null;
  const rel = formatRelativeTime(toMillis(syncedAt));
  return rel ? `${label} · ${rel}` : label;
};

/**
 * Liste des comptes.
 *
 * Les lignes étaient des cartes indépendantes (`rounded-[…] p-7`, 28 px de
 * padding hors grille) espacées de 20 px. Elles deviennent une <List> : le
 * rayon est porté par le conteneur, les lignes sont séparées par un filet, et
 * la hauteur de 56 px est celle de tout le système.
 */
export const AurumAccountsList: React.FC<{
  accounts: Account[];
  onAccountClick?: (name: string) => void;
}> = ({ accounts, onAccountClick }) => (
  <List>
    {accounts.map((acc) => {
      const sync = syncLabel(acc.source, acc.syncedAt);
      return (
        <ListItem
          key={acc.id}
          data-testid={`account-${acc.id}-card`}
          leading={<BankLogo name={acc.bankName || acc.name} size={40} />}
          title={acc.name}
          subtitle={acc.owner || 'Personnel'}
          onClick={onAccountClick ? () => onAccountClick(acc.name) : undefined}
          trailing={
            <Stack gap="none" align="end">
              <Amount value={acc.balance} tone="neutral" />
              {sync && (
                <Text variant="caption" tone="tertiary">
                  {sync}
                </Text>
              )}
            </Stack>
          }
        />
      );
    })}
  </List>
);
