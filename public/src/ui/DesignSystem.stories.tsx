import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import {
  Amount,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  IconButton,
  Input,
  List,
  ListItem,
  ProgressBar,
  Section,
  SegmentedControl,
  Separator,
  Stack,
  Switch,
  Text,
  Tile,
  radius,
  space,
  type TextVariant,
} from './index';
import { Search, Wallet, CircleDashed } from 'lucide-react';

const meta: Meta = {
  title: 'Design System/AURUM v3',
  parameters: { layout: 'padded', backgrounds: { default: 'aurum-ink' } },
};
export default meta;

const RAMP: { variant: TextVariant; sample: string; spec: string }[] = [
  { variant: 'display', sample: '8 420,55 €', spec: '34 / 40 · 600' },
  { variant: 'title1', sample: 'Patrimoine', spec: '28 / 34 · 600' },
  { variant: 'title2', sample: 'Comptes courants', spec: '22 / 28 · 600' },
  { variant: 'title3', sample: 'Reste à vivre', spec: '20 / 26 · 600' },
  { variant: 'headline', sample: 'Carrefour Market', spec: '17 / 22 · 600' },
  { variant: 'body', sample: "Sept opérations attendent d'être pointées.", spec: '17 / 22 · 400' },
  { variant: 'callout', sample: 'Virement reçu le 3 juillet', spec: '16 / 22 · 400' },
  { variant: 'subhead', sample: 'Boursorama · Compte joint', spec: '15 / 20 · 400' },
  { variant: 'footnote', sample: "Aujourd'hui, 14:32", spec: '13 / 18 · 400' },
  { variant: 'caption', sample: 'Alimentation', spec: '12 / 16 · 500' },
  { variant: 'overline', sample: 'juillet 2026', spec: '12 / 16 · 0.06em' },
];

export const Typographie: StoryObj = {
  render: () => (
    <Stack gap="md">
      {RAMP.map((r) => (
        <div key={r.variant} className="flex items-baseline gap-6 border-b border-separator pb-2">
          <Text variant="caption" tone="accent" className="w-24 shrink-0">
            {r.variant}
          </Text>
          <Text variant={r.variant} className="flex-1">
            {r.sample}
          </Text>
          <Text variant="caption" tone="tertiary" numeric className="shrink-0">
            {r.spec}
          </Text>
        </div>
      ))}
    </Stack>
  ),
};

export const Rayons: StoryObj = {
  render: () => (
    <Stack direction="row" gap="lg" align="end" wrap>
      {Object.entries(radius)
        .filter(([k]) => k !== 'full')
        .map(([name, px]) => (
          <Stack key={name} gap="sm" align="center">
            <div
              className="grid h-24 w-24 place-items-center bg-surface"
              style={{ borderRadius: px }}
            >
              <Text variant="footnote" tone="accent" numeric>
                {px} px
              </Text>
            </div>
            <Text variant="caption" tone="tertiary">
              radius-{name}
            </Text>
          </Stack>
        ))}
    </Stack>
  ),
};

export const Espacement: StoryObj = {
  render: () => (
    <Stack gap="sm">
      {Object.entries(space).map(([name, px]) => (
        <Stack key={name} direction="row" gap="md" align="center">
          <Text variant="footnote" numeric className="w-16">
            {px} px
          </Text>
          <div className="h-4 rounded-sm bg-gold" style={{ width: px }} />
          <Text variant="footnote" tone="tertiary">
            space-{name}
          </Text>
        </Stack>
      ))}
    </Stack>
  ),
};

export const Boutons: StoryObj = {
  render: () => (
    <Stack gap="lg">
      <Stack direction="row" gap="md" wrap align="center">
        <Button variant="primary">Enregistrer</Button>
        <Button variant="secondary">Annuler</Button>
        <Button variant="plain">Tout voir</Button>
        <Button variant="destructive">Supprimer</Button>
        <Button variant="primary" loading>
          Envoi
        </Button>
      </Stack>
      <Stack direction="row" gap="md" wrap align="center">
        <Button variant="primary" size="sm">
          Petit · 36
        </Button>
        <Button variant="primary">Standard · 44</Button>
        <Button variant="primary" size="lg">
          Large · 52
        </Button>
        <IconButton label="Rechercher">
          <Search size={20} />
        </IconButton>
      </Stack>
    </Stack>
  ),
};

export const Indicateurs: StoryObj = {
  render: () => (
    <Stack gap="lg">
      <Stack direction="row" gap="md" wrap align="center">
        <Badge tone="accent">Pointé</Badge>
        <Badge tone="positive" dot>
          Dans le budget
        </Badge>
        <Badge tone="warning">88 % consommé</Badge>
        <Badge tone="negative">Dépassé de 10 €</Badge>
        <Badge tone="neutral">Récurrent</Badge>
      </Stack>
      <Stack direction="row" gap="md" wrap>
        <Chip selected>Tout</Chip>
        <Chip>Dépenses</Chip>
        <Chip>Revenus</Chip>
      </Stack>
      <Stack gap="sm">
        <ProgressBar value={0.38} label="Loisirs" />
        <ProgressBar value={0.84} tone="warning" label="Alimentation" />
        <ProgressBar value={1} tone="negative" label="Transport" />
      </Stack>
    </Stack>
  ),
};

export const Montants: StoryObj = {
  render: () => (
    <Stack gap="md">
      <Amount value={8420.55} variant="display" tone="neutral" />
      <Amount value={2640} signed />
      <Amount value={-62.4} />
      <Amount value={null} />
    </Stack>
  ),
};

export const Saisie: StoryObj = {
  render: function Render() {
    const [compact, setCompact] = useState(true);
    const [filter, setFilter] = useState<'all' | 'out' | 'in'>('all');
    return (
      <Stack gap="lg" className="max-w-sm">
        <Field label="Montant" hint="Séparateur décimal : virgule ou point.">
          {(p) => <Input {...p} inputMode="decimal" defaultValue="42,90" />}
        </Field>
        <Field label="Libellé" error="Ce champ est obligatoire.">
          {(p) => <Input {...p} placeholder="Carrefour Market" />}
        </Field>
        <SegmentedControl
          label="Type"
          value={filter}
          onChange={setFilter}
          block
          segments={[
            { value: 'all', label: 'Tout' },
            { value: 'out', label: 'Dépenses' },
            { value: 'in', label: 'Revenus' },
          ]}
        />
        <Stack direction="row" gap="md" align="center" justify="between">
          <Text variant="callout">Mode compact</Text>
          <Switch checked={compact} onChange={setCompact} label="Mode compact" />
        </Stack>
      </Stack>
    );
  },
};

export const CartesEtListes: StoryObj = {
  render: () => (
    <Stack gap="lg" className="max-w-md">
      <Section title="Comptes" action={<Button variant="plain">Tout voir</Button>}>
        <List>
          <ListItem
            leading={
              <Tile tone="accent">
                <Wallet size={18} />
              </Tile>
            }
            title="Boursorama"
            subtitle="Compte joint · synchronisé il y a 4 min"
            trailing={<Amount value={4210.3} tone="neutral" />}
          />
          <ListItem
            leading={
              <Tile>
                <Wallet size={18} />
              </Tile>
            }
            title="Crédit Agricole"
            subtitle="Compte courant"
            trailing={<Amount value={3180.25} tone="neutral" />}
          />
        </List>
      </Section>

      <Card>
        <Stack direction="row" gap="md" align="center">
          <Tile tone="accent">
            <CircleDashed size={18} />
          </Tile>
          <Stack gap="none" className="flex-1">
            <Text variant="headline">À pointer</Text>
            <Text variant="footnote" tone="tertiary">
              7 opérations en attente
            </Text>
          </Stack>
          <Badge tone="accent">7</Badge>
        </Stack>
        <Separator className="my-4" />
        <ProgressBar value={0.56} label="Reste à vivre" />
      </Card>

      <Card padding="none">
        <EmptyState
          icon={<Search size={22} />}
          title="Aucune opération"
          description="Aucune transaction ne correspond à ces filtres sur juillet 2026."
          action={{ label: 'Réinitialiser', onClick: () => {} }}
        />
      </Card>
    </Stack>
  ),
};
