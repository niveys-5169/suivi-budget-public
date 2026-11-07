import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Amount,
  Badge,
  Card,
  EmptyState,
  IconButton,
  List,
  ListItem,
  ProgressBar,
  Screen,
  Select,
  Skeleton,
  Stack,
  Text,
} from '../../ui';
import { formatCurrency } from '../../lib/formatters';
import { useWeeklyRecaps } from '../../hooks/useWeeklyRecaps';
import type { WeeklyRecap, WeeklyRecapBudget } from '../../types/banking.types';

/** '2026-11-07' → '07/11' (ou '07/11/2026' avec l'année). */
const dayMonth = (iso: string, withYear = false): string => {
  const [y, m, d] = iso.split('-');
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
};

export const weekLabel = (recap: WeeklyRecap): string =>
  `Semaine du ${dayMonth(recap.period.start)} au ${dayMonth(recap.period.end, true)}`;

const budgetTone = (b: WeeklyRecapBudget, threshold: number) =>
  b.pourcentage > 100 ? 'negative' : b.pourcentage >= threshold ? 'warning' : 'positive';

/** Section dépliable : un titre toujours visible, le détail au toucher. */
const Disclosure: React.FC<{
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, summary, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card padding="none">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full items-center gap-4 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset"
      >
        <Text variant="headline" as="span" className="flex-1">
          {title}
        </Text>
        {summary}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 text-label-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="border-t border-separator">{children}</div>}
    </Card>
  );
};

/** Ligne dépliable d'une liste (catégorie, budget). */
const ExpandableRow: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  trailing: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, trailing, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <ListItem
        compact
        title={title}
        subtitle={subtitle}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        trailing={
          <Stack direction="row" gap="sm" align="center">
            {trailing}
            <ChevronRight
              size={16}
              aria-hidden="true"
              className={`text-label-tertiary transition-transform ${open ? 'rotate-90' : ''}`}
            />
          </Stack>
        }
      />
      {open && <div className="bg-raised/40 px-4 py-2">{children}</div>}
    </div>
  );
};

const WeekContent: React.FC<{ recap: WeeklyRecap }> = ({ recap }) => {
  const { expenses, budgets, balances } = recap;
  const threshold = recap.options?.warning_threshold ?? 80;
  const transactions = expenses.transactions ?? expenses.top_transactions;
  const nExceeded = budgets.exceeded.length;
  const nWarning = budgets.warning.length;

  return (
    <>
      <Card>
        <Stack gap="sm">
          <Text variant="overline" tone="secondary">
            Dépensé cette semaine
          </Text>
          <Amount value={-expenses.total_expenses} variant="title1" tone="neutral" />
          <Stack direction="row" gap="sm" wrap>
            {nExceeded > 0 && <Badge tone="negative">{nExceeded} budget(s) dépassé(s)</Badge>}
            {nWarning > 0 && <Badge tone="warning">{nWarning} à surveiller</Badge>}
            {nExceeded === 0 && nWarning === 0 && budgets.variables.length > 0 && (
              <Badge tone="positive">Budgets sous contrôle</Badge>
            )}
          </Stack>
          {recap.source === 'backfill' && (
            <Text variant="footnote" tone="tertiary">
              Fiche recalculée après coup : budgets d&apos;aujourd&apos;hui
              {balances.accounts.length === 0 ? ', soldes non disponibles' : ''}.
            </Text>
          )}
        </Stack>
      </Card>

      <Disclosure
        title="Dépenses par catégorie"
        defaultOpen
        summary={
          <Text variant="subhead" tone="secondary">
            {expenses.categories.length}
          </Text>
        }
      >
        {expenses.categories.length === 0 ? (
          <Text variant="subhead" tone="secondary" className="p-4">
            Aucune dépense variable cette semaine.
          </Text>
        ) : (
          <List divided plain>
            {expenses.categories.map((cat) => {
              const ops = transactions
                .filter((t) => t.categorie === cat.categorie)
                .sort((a, b) => b.date.localeCompare(a.date));
              return (
                <ExpandableRow
                  key={cat.categorie}
                  title={cat.categorie}
                  subtitle={`${cat.pourcentage} % · ${ops.length} opération(s)`}
                  trailing={<Amount value={-cat.montant} variant="callout" tone="neutral" />}
                >
                  {ops.map((t, i) => (
                    <Stack key={i} direction="row" justify="between" gap="md" className="py-1">
                      <Text variant="subhead" truncate className="min-w-0 flex-1">
                        {dayMonth(t.date)} · {t.libelle}
                      </Text>
                      <Amount value={-t.montant} variant="subhead" />
                    </Stack>
                  ))}
                </ExpandableRow>
              );
            })}
          </List>
        )}
      </Disclosure>

      {budgets.variables.length > 0 && (
        <Disclosure
          title="Budgets du mois"
          summary={
            nExceeded + nWarning > 0 ? (
              <Badge tone={nExceeded > 0 ? 'negative' : 'warning'}>{nExceeded + nWarning}</Badge>
            ) : undefined
          }
        >
          <List divided plain>
            {budgets.variables.map((b) => (
              <ExpandableRow
                key={b.categorie}
                title={b.categorie}
                subtitle={
                  <ProgressBar
                    value={b.pourcentage / 100}
                    tone={budgetTone(b, threshold)}
                    label={`${b.categorie} : ${b.pourcentage} %`}
                    className="mt-1"
                  />
                }
                trailing={
                  <Text variant="callout" tone={budgetTone(b, threshold)} numeric>
                    {b.pourcentage} %
                  </Text>
                }
              >
                <Text variant="subhead">
                  {formatCurrency(b.depense)} dépensés sur {formatCurrency(b.budget)}
                </Text>
                <Text variant="subhead" tone={b.reste >= 0 ? 'positive' : 'negative'}>
                  {b.reste >= 0
                    ? `Reste ${formatCurrency(b.reste)}`
                    : `Dépassé de ${formatCurrency(b.depassement)}`}
                </Text>
                {b.depense_mois_precedent !== undefined && (
                  <Text variant="footnote" tone="tertiary">
                    Mois précédent à la même date : {formatCurrency(b.depense_mois_precedent)}
                  </Text>
                )}
              </ExpandableRow>
            ))}
          </List>
        </Disclosure>
      )}

      {budgets.envelopes.length > 0 && (
        <Disclosure title="Enveloppes annuelles">
          <List divided plain>
            {budgets.envelopes.map((e) => (
              <ListItem
                key={e.categorie}
                compact
                title={e.categorie}
                subtitle={`${formatCurrency(e.depense)} / ${formatCurrency(e.budget)} · échéance ${e.echeance.split('-').reverse().join('/')}`}
                trailing={
                  <Text variant="callout" tone={e.reste < 0 ? 'negative' : 'primary'} numeric>
                    Reste {formatCurrency(e.reste)}
                  </Text>
                }
              />
            ))}
          </List>
        </Disclosure>
      )}

      {(balances.accounts.length > 0 || balances.savings_accounts.length > 0) && (
        <Disclosure
          title="Soldes des comptes"
          summary={
            balances.accounts.length > 0 ? (
              <Amount value={balances.total} variant="subhead" tone="neutral" />
            ) : undefined
          }
        >
          <List divided plain>
            {[
              ...balances.accounts,
              ...balances.savings_accounts.map((s) => ({ ...s, status_label: 'Épargne' })),
            ].map((a) => (
              <ListItem
                key={a.compte}
                compact
                title={a.compte}
                subtitle={a.status_label}
                trailing={<Amount value={a.solde} variant="callout" tone="neutral" />}
              />
            ))}
          </List>
        </Disclosure>
      )}
    </>
  );
};

/**
 * Fiche « Ma semaine » : le bilan enregistré par l'email hebdomadaire, avec
 * navigation entre les semaines. Route `/semaine/:weekId?` (dernière semaine
 * par défaut), sans entrée de menu : on y arrive depuis le lien de l'email.
 */
export const WeeklyRecapPage: React.FC = () => {
  const { weekId } = useParams();
  const navigate = useNavigate();
  const { recaps, loading } = useWeeklyRecaps();

  const index = weekId ? recaps.findIndex((r) => r.id === weekId) : 0;
  const recap = recaps[index];
  const older = index >= 0 ? recaps[index + 1] : undefined;
  const newer = index > 0 ? recaps[index - 1] : undefined;
  const goTo = (id: string) => navigate(`/semaine/${id}`);

  const toolbar =
    recaps.length > 0 ? (
      <Stack
        direction="row"
        gap="sm"
        align="center"
        className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-6"
      >
        <IconButton
          label="Semaine précédente"
          disabled={!older}
          onClick={() => older && goTo(older.id)}
        >
          <ChevronLeft size={20} />
        </IconButton>
        <Select
          aria-label="Choisir la semaine"
          value={recap?.id ?? ''}
          onChange={(e) => goTo(e.target.value)}
          className="flex-1"
        >
          {!recap && <option value="">Semaine introuvable</option>}
          {recaps.map((r) => (
            <option key={r.id} value={r.id}>
              {weekLabel(r)}
            </option>
          ))}
        </Select>
        <IconButton
          label="Semaine suivante"
          disabled={!newer}
          onClick={() => newer && goTo(newer.id)}
        >
          <ChevronRight size={20} />
        </IconButton>
      </Stack>
    ) : undefined;

  return (
    <Screen title="Ma semaine" toolbar={toolbar}>
      {loading ? (
        <Skeleton className="h-40" />
      ) : recaps.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={24} />}
          title="Aucune semaine enregistrée"
          description="La fiche de la semaine est créée à chaque envoi de l'email récapitulatif."
        />
      ) : !recap ? (
        <EmptyState
          icon={<CalendarDays size={24} />}
          title="Semaine introuvable"
          description="Cette semaine n'a pas de fiche. Choisissez-en une autre dans la liste."
        />
      ) : (
        <WeekContent recap={recap} />
      )}
    </Screen>
  );
};
