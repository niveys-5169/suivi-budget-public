import React from 'react';
import { ChevronLeft, Pencil, Receipt } from 'lucide-react';
import {
  Amount,
  Button,
  Card,
  EmptyState,
  IconButton,
  List,
  ListItem,
  ProgressBar,
  Section,
  Text,
} from '../../ui';
import { formatCurrency } from '../../lib/formatters';
import type { AnnualEnvelope } from '../../utils/annualEnvelope';
import { getAssignedMonthKey } from '../../utils/date';

const eur = (n: number) => formatCurrency(n, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });

/** `YYYY-MM` → « Juillet 2027 ». */
export const echeanceLabel = (key: string) => {
  const [y = NaN, m = NaN] = key.split('-').map(Number);
  const label = new Date(y, m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/** `YYYY-MM-DD` → « 5 mars 2027 », sans décalage de fuseau. */
const dayLabel = (date: string) => {
  const [y = NaN, m = NaN, d = NaN] = date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

interface Props {
  envelope: AnnualEnvelope;
  onBack: () => void;
  onEdit: () => void;
  onOpenTransaction?: (id: string) => void;
}

/**
 * Détail d'une enveloppe annuelle : le cycle suivi et la liste des
 * transactions comptées dans le montant dépensé.
 */
export const AnnualEnvelopeDetail: React.FC<Props> = ({
  envelope: e,
  onBack,
  onEdit,
  onOpenTransaction,
}) => {
  const ratio = e.montant > 0 ? e.depense / e.montant : 0;
  const cycle = `${echeanceLabel(e.debutKey)} → ${echeanceLabel(e.echeanceKey).toLowerCase()}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <IconButton label="Retour aux enveloppes" variant="plain" size="sm" onClick={onBack}>
          <ChevronLeft size={20} />
        </IconButton>
        <Text variant="title2" truncate className="flex-1 min-w-0">
          {e.categorie}
        </Text>
        <Button variant="plain" size="sm" onClick={onEdit}>
          <Pencil size={16} aria-hidden="true" />
          Modifier
        </Button>
      </div>

      <Card className="flex flex-col gap-2">
        <Text variant="footnote" tone="tertiary">
          {cycle}
        </Text>
        <Text variant="title1">
          {eur(e.depense)}{' '}
          <Text as="span" variant="subhead" tone="secondary">
            / {eur(e.montant)}
          </Text>
        </Text>
        <ProgressBar
          value={ratio}
          tone={ratio > 1 ? 'negative' : 'accent'}
          label={`${e.categorie} : ${Math.round(ratio * 100)} % utilisé`}
        />
        <Text variant="footnote" tone="secondary">
          Reste {eur(e.reste)} · {eur(e.provisionMensuelle)}/mois
        </Text>
      </Card>

      <Section title="Transactions prises en compte">
        {e.transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28} aria-hidden="true" />}
            title="Aucune transaction"
            description="Aucune dépense de cette catégorie sur le cycle en cours."
          />
        ) : (
          <List>
            {e.transactions.map((t, i) => {
              const assigned = getAssignedMonthKey(t);
              const shifted = Boolean(t.date) && assigned !== (t.date || '').slice(0, 7);
              return (
                <ListItem
                  key={t.id ?? i}
                  onClick={t.id && onOpenTransaction ? () => onOpenTransaction(t.id!) : undefined}
                  title={
                    <Text variant="body" truncate>
                      {t.libelle || 'Sans libellé'}
                    </Text>
                  }
                  subtitle={
                    <Text variant="footnote" tone="tertiary">
                      {t.date ? dayLabel(t.date) : ''}
                      {shifted && ` · affectée à ${echeanceLabel(assigned).toLowerCase()}`}
                    </Text>
                  }
                  trailing={<Amount value={Number(t.montant) || 0} variant="subhead" signed />}
                />
              );
            })}
          </List>
        )}
      </Section>
    </div>
  );
};
