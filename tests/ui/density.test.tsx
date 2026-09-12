import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, ListItem, NavBar, Screen, Toolbar } from '../../public/src/ui';
import { MTransactionRow } from '../../public/src/mobile/components/MTransactionRow';
import { MDateGroupHeader } from '../../public/src/mobile/components/MDateGroupHeader';
import type { Transaction } from '../../public/src/types/banking.types';

/**
 * Le mode compact vit dans un seul bloc de `tailwind.css`, sous
 * `html[data-density="compact"]`. jsdom ne calcule pas la cascade : ces tests
 * ne vérifient donc pas les pixels, mais l'ABONNEMENT — qu'un composant porte
 * bien son crochet `density-*`.
 *
 * C'est ce qui manquait : les deux listes de transactions, précisément l'écran
 * que le mode compact annonce servir, n'étaient abonnées à rien.
 */

const tx: Transaction = {
  id: 'tx-1',
  libelle: 'Prélèvement assurance',
  montant: -42.5,
  date: '2026-07-04',
  categorie: 'Assurance',
  compte: 'BforBank',
  pointe: true,
} as Transaction;

describe('Crochets de densité', () => {
  it('<Card> ne s’abonne que sur le palier md, le seul qui a de la marge', () => {
    const { container, rerender } = render(<Card padding="md">Solde</Card>);
    expect(container.firstElementChild).toHaveClass('density-card');

    rerender(<Card padding="sm">Solde</Card>);
    expect(container.firstElementChild).not.toHaveClass('density-card');

    rerender(<Card padding="none">Solde</Card>);
    expect(container.firstElementChild).not.toHaveClass('density-card');
  });

  it('<ListItem> abonne la ligne et sa tuile de tête', () => {
    const { container } = render(<ListItem leading={<span>icône</span>} title="Loyer" />);

    const row = container.querySelector('.density-row');
    expect(row).not.toBeNull();
    expect(row?.querySelector('.density-row-icon')).not.toBeNull();
  });

  it('<Screen> abonne le rythme vertical et sa barre de titre', () => {
    const { container } = render(
      <Screen title="Flux">
        <p>contenu</p>
      </Screen>,
    );

    expect(container.querySelector('main')).toHaveClass('density-screen');
    expect(container.querySelector('.density-navbar')).not.toBeNull();
  });

  it('<Toolbar> abonne le bandeau de filtres', () => {
    const { container } = render(<Toolbar>filtres</Toolbar>);
    expect(container.firstElementChild).toHaveClass('density-toolbar');
  });

  it('<NavBar> abonne sa hauteur', () => {
    const { container } = render(<NavBar title="Patrimoine" />);
    expect(container.querySelector('.density-navbar')).not.toBeNull();
  });

  it('la ligne de transaction mobile est abonnée, ligne comme icône', () => {
    const { container } = render(<MTransactionRow transaction={tx} />);

    const row = screen.getByRole('button');
    expect(row).toHaveClass('density-row');
    expect(container.querySelector('.density-row .density-row-icon')).not.toBeNull();
  });

  it('l’en-tête de groupe de dates est abonné', () => {
    const { container } = render(<MDateGroupHeader date="2026-07-04" total={-120} />);
    expect(container.firstElementChild).toHaveClass('density-group-header');
  });
});
