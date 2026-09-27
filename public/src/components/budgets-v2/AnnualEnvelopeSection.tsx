import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Section, List, ListItem, Tile, ProgressBar, Button, Text } from '../../ui';
import { CategoryIcon } from '../CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { formatCurrency } from '../../lib/formatters';
import type { AnnualEnvelope } from '../../utils/annualEnvelope';
import { AnnualEnvelopeFormModal } from './AnnualEnvelopeFormModal';

const eur = (n: number) => formatCurrency(n, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });

const echeanceLabel = (key: string) => {
  const [y = NaN, m = NaN] = key.split('-').map(Number);
  const label = new Date(y, m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

interface Props {
  envelopes: AnnualEnvelope[];
  categories: string[];
}

/**
 * Bloc « Enveloppes annuelles » de l'écran Budgets (desktop et mobile) :
 * une ligne par enveloppe, un bouton pour en ajouter. Toucher une ligne ouvre
 * la même fenêtre, pré-remplie.
 */
export const AnnualEnvelopeSection: React.FC<Props> = ({ envelopes, categories }) => {
  const [editing, setEditing] = useState<AnnualEnvelope | 'new' | null>(null);

  const addButton = (
    <Button variant="plain" size="sm" onClick={() => setEditing('new')}>
      <Plus size={16} aria-hidden="true" />
      {envelopes.length === 0 ? 'Enveloppe annuelle (vacances, impôts…)' : 'Ajouter'}
    </Button>
  );

  return (
    <>
      {envelopes.length === 0 ? (
        <div className="flex justify-center">{addButton}</div>
      ) : (
        <Section title="Enveloppes annuelles" action={addButton}>
          <List>
            {envelopes.map((e) => {
              const meta = getCategoryMeta(e.categorie);
              const ratio = e.montant > 0 ? e.depense / e.montant : 0;
              return (
                <ListItem
                  key={e.categorie}
                  onClick={() => setEditing(e)}
                  leading={
                    <Tile>
                      <span style={{ color: meta.color }}>
                        <CategoryIcon icon={meta.icon} size={18} />
                      </span>
                    </Tile>
                  }
                  title={
                    <span className="flex items-baseline justify-between gap-2">
                      <Text variant="headline" truncate>
                        {e.categorie}
                      </Text>
                      <Text variant="subhead" tone="secondary" className="shrink-0">
                        {eur(e.depense)} / {eur(e.montant)}
                      </Text>
                    </span>
                  }
                  subtitle={
                    <span className="flex flex-col gap-1 pt-1">
                      <ProgressBar
                        value={ratio}
                        tone={ratio > 1 ? 'negative' : 'accent'}
                        label={`${e.categorie} : ${Math.round(ratio * 100)} % utilisé`}
                      />
                      <Text variant="footnote" tone="tertiary">
                        {echeanceLabel(e.echeanceKey)} · reste {eur(e.reste)} ·{' '}
                        {eur(e.provisionMensuelle)}/mois à mettre de côté
                      </Text>
                    </span>
                  }
                />
              );
            })}
          </List>
        </Section>
      )}

      {editing && (
        <AnnualEnvelopeFormModal
          isOpen
          onClose={() => setEditing(null)}
          envelope={editing === 'new' ? undefined : editing}
          categories={categories}
        />
      )}
    </>
  );
};
