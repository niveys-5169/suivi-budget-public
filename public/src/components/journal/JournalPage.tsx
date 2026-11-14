import React, { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  List,
  ListItem,
  Screen,
  Select,
  Skeleton,
  Stack,
  Text,
} from '../../ui';
import { PAGE_SIZE, useAuditLog } from '../../hooks/useAuditLog';
import { DOMAIN_LABELS, describeEntry, formatAuditDate } from '../../utils/auditLog';
import type { AuditDomain } from '../../types/banking.types';

const DOMAINS = Object.keys(DOMAIN_LABELS) as AuditDomain[];

/**
 * Journal des modifications : qui a changé quoi sur les transactions, les
 * budgets et les récurrences. Route `/journal`, commune desktop et PWA.
 */
export const JournalPage: React.FC = () => {
  const [max, setMax] = useState(PAGE_SIZE);
  const [person, setPerson] = useState('');
  const [domain, setDomain] = useState('');
  const { entries, loading } = useAuditLog(max);

  const people = useMemo(() => [...new Set(entries.map((e) => e.byEmail))].sort(), [entries]);
  const shown = entries.filter(
    (e) => (!person || e.byEmail === person) && (!domain || e.domain === domain),
  );

  const toolbar = (
    <Stack direction="row" gap="sm" className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-6">
      <Select
        aria-label="Filtrer par personne"
        value={person}
        onChange={(e) => setPerson(e.target.value)}
        className="min-w-0 flex-1"
      >
        <option value="">Tout le monde</option>
        {people.map((email) => (
          <option key={email} value={email}>
            {email}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrer par domaine"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        className="min-w-0 flex-1"
      >
        <option value="">Tous les domaines</option>
        {DOMAINS.map((d) => (
          <option key={d} value={d}>
            {DOMAIN_LABELS[d]}
          </option>
        ))}
      </Select>
    </Stack>
  );

  return (
    <Screen title="Journal" toolbar={toolbar}>
      {loading ? (
        <Skeleton className="h-40" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<History size={24} />}
          title="Aucune modification enregistrée"
          description="Les changements faits sur les transactions, les budgets et les récurrences apparaîtront ici."
        />
      ) : shown.length === 0 ? (
        <EmptyState icon={<History size={24} />} title="Aucune modification pour ces filtres" />
      ) : (
        <Stack gap="md">
          <Card padding="none">
            <List as="ul" divided plain>
              {shown.map((entry) => (
                <ListItem
                  key={entry.id}
                  as="li"
                  title={entry.label || '(sans libellé)'}
                  subtitle={
                    <Stack as="span" gap="xs">
                      <Text variant="subhead" as="span">
                        {describeEntry(entry)}
                      </Text>
                      <Text variant="footnote" tone="tertiary" as="span">
                        {entry.byEmail} · {formatAuditDate(entry.at)}
                      </Text>
                    </Stack>
                  }
                  trailing={<Badge>{DOMAIN_LABELS[entry.domain]}</Badge>}
                />
              ))}
            </List>
          </Card>
          {entries.length >= max && (
            <Button variant="secondary" onClick={() => setMax(max + PAGE_SIZE)}>
              Voir plus
            </Button>
          )}
        </Stack>
      )}
    </Screen>
  );
};
