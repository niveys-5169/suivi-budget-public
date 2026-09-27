import React, { useState } from 'react';
import { PiggyBank, Plus } from 'lucide-react';
import {
  Section,
  List,
  ListItem,
  Tile,
  ProgressBar,
  Button,
  Text,
  Card,
  EmptyState,
} from '../../ui';
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
 * Onglet « Enveloppes » de l'écran Budgets (desktop et mobile) : ce qu'il faut
 * mettre de côté chaque mois, puis une ligne par enveloppe. Toucher une ligne
 * ouvre la fenêtre de l'enveloppe, pré-remplie.
 */
export const AnnualEnvelopesTab: React.FC<Props> = ({ envelopes, categories }) => {
  const [editing, setEditing] = useState<AnnualEnvelope | 'new' | null>(null);

  const provision = envelopes.reduce((s, e) => s + e.provisionMensuelle, 0);
  const depense = envelopes.reduce((s, e) => s + e.depense, 0);
  const total = envelopes.reduce((s, e) => s + e.montant, 0);

  return (
    <div className="flex flex-col gap-6">
      {envelopes.length === 0 ? (
        <EmptyState
          icon={<PiggyBank size={28} aria-hidden="true" />}
          title="Aucune enveloppe"
          description="Pour les dépenses qui reviennent une fois par an : vacances, impôts, assurances… On les suit sur l'année et on met de côté un peu chaque mois."
          action={{ label: 'Créer une enveloppe', onClick: () => setEditing('new') }}
        />
      ) : (
        <>
          <Card className="flex flex-col items-center gap-1 text-center">
            <Text variant="footnote" tone="tertiary">
              À mettre de côté chaque mois
            </Text>
            <Text variant="title1" tone="accent">
              {eur(provision)}
            </Text>
            <Text variant="footnote" tone="secondary">
              {eur(depense)} dépensés sur {eur(total)} prévus
            </Text>
          </Card>

          <Section
            title="Enveloppes annuelles"
            action={
              <Button variant="plain" size="sm" onClick={() => setEditing('new')}>
                <Plus size={16} aria-hidden="true" />
                Ajouter
              </Button>
            }
          >
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
                          {eur(e.provisionMensuelle)}/mois
                        </Text>
                      </span>
                    }
                  />
                );
              })}
            </List>
          </Section>
        </>
      )}

      {editing && (
        <AnnualEnvelopeFormModal
          isOpen
          onClose={() => setEditing(null)}
          envelope={editing === 'new' ? undefined : editing}
          categories={categories}
        />
      )}
    </div>
  );
};
