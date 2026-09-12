import React, { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Amount, Button, List, ListItem, Stack, Text, Tile } from '../../ui';
import { CategoryIcon } from '../CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { useRecurrences } from '../../hooks/useRecurrences';
import type { Recurrence, Transaction } from '../../types/banking.types';

interface RecurrenceLinkFieldProps {
  /** Transaction ENREGISTRÉE — la liaison écrit sur le document, pas sur le formulaire. */
  transaction: Transaction;
}

/**
 * Rattache une transaction à une récurrence existante depuis la modal de
 * transaction — le sens inverse de `LinkRecurrenceModal`, qui part de la
 * récurrence. Les candidates sont classées par le même barème (`linkScore`),
 * pour que les deux surfaces proposent le même ordre.
 *
 * Rendu en ligne dans le formulaire plutôt qu'en sous-feuille : deux `Sheet`
 * empilées partagent l'écoute `Escape` et le piège de focus, et se fermeraient
 * ensemble.
 */
export const RecurrenceLinkField: React.FC<RecurrenceLinkFieldProps> = ({ transaction }) => {
  const { formatMessage: t } = useIntl();

  // Le mois de la TRANSACTION, pas celui affiché à l'écran : c'est la période
  // que `link()` approuvera par défaut.
  const monthKey = transaction.moisAffectation || (transaction.date || '').slice(0, 7);
  const {
    mappings: { linkedTxToRecurrence },
    recurrenceCandidates,
    link,
    unlink,
  } = useRecurrences(monthKey);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const linked = linkedTxToRecurrence[transaction.id];
  const candidates = useMemo(
    () => (open ? recurrenceCandidates(transaction) : []),
    [open, recurrenceCandidates, transaction],
  );

  /** La façade signale déjà l'échec par un toast : on ne fait que refermer. */
  const run = async (action: Promise<void>) => {
    setBusy(true);
    await action.then(() => setOpen(false)).catch(() => {});
    setBusy(false);
  };

  /** Pourquoi cette récurrence est proposée : catégorie, sinon écart de montant. */
  const hint = (rec: Recurrence) => {
    const sameCategory =
      (transaction.categorie || '').trim().toLowerCase() === rec.category.trim().toLowerCase();
    if (sameCategory) return t({ id: 'tx.form.link.sameCategory' });
    const target = Math.abs(rec.expectedAmount);
    const gap = target > 0 ? Math.abs(Math.abs(transaction.montant ?? 0) - target) / target : 1;
    return t({ id: 'tx.form.link.gap' }, { pct: Math.round(gap * 100) });
  };

  if (linked) {
    return (
      <Stack direction="row" gap="sm" align="center" className="rounded-md bg-raised p-4">
        <Text variant="footnote" tone="secondary" className="min-w-0 flex-1" truncate>
          {t({ id: 'tx.form.link.linked' })} : <strong>{linked.label}</strong>
        </Text>
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          onClick={() => run(unlink(linked.id, transaction.id))}
        >
          {t({ id: 'tx.form.link.unlink' })}
        </Button>
      </Stack>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" block onClick={() => setOpen(true)}>
        <Link2 size={16} aria-hidden="true" />
        {t({ id: 'tx.form.link' })}
      </Button>
    );
  }

  return (
    <Stack gap="sm">
      {candidates.length === 0 ? (
        <Text variant="footnote" tone="tertiary">
          {t({ id: 'tx.form.link.empty' })}
        </Text>
      ) : (
        <List
          className={`max-h-64 overflow-y-auto ${busy ? 'pointer-events-none opacity-40' : ''}`}
        >
          {candidates.map((rec) => (
            <ListItem
              key={rec.id}
              compact
              leading={
                <Tile>
                  <CategoryIcon icon={getCategoryMeta(rec.category).icon} size={16} />
                </Tile>
              }
              title={rec.label}
              subtitle={`${rec.category} · ${hint(rec)}`}
              trailing={<Amount value={rec.expectedAmount} variant="footnote" />}
              onClick={() => run(link(rec, transaction))}
            />
          ))}
        </List>
      )}
      <Button variant="plain" size="sm" onClick={() => setOpen(false)}>
        {t({ id: 'tx.form.link.cancel' })}
      </Button>
    </Stack>
  );
};
