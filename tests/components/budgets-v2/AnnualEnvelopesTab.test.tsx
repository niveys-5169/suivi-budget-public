import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnnualEnvelopesTab } from '../../../public/src/components/budgets-v2/AnnualEnvelopesTab';
import type { BudgetSortMode } from '../../../public/src/hooks/usePreferences';
import type { AnnualEnvelope } from '../../../public/src/utils/annualEnvelope';

vi.mock('../../../public/src/hooks/useBudget', () => ({
  useBudget: () => ({}),
}));

const envelope = (categorie: string, montant: number): AnnualEnvelope => ({
  categorie,
  montant,
  depense: 0,
  reste: montant,
  echeanceKey: '2026-12',
  moisEcheance: 12,
  provisionMensuelle: montant / 12,
});

const ENVELOPES = [
  envelope('Impôts', 1200),
  envelope('Vacances', 3000),
  envelope('Assurance', 600),
];

const renderTab = (sortMode: BudgetSortMode, manualOrder: string[] = []) => {
  const onSortModeChange = vi.fn();
  render(
    <AnnualEnvelopesTab
      envelopes={ENVELOPES}
      categories={[]}
      sortMode={sortMode}
      onSortModeChange={onSortModeChange}
      manualOrder={manualOrder}
      onReorder={vi.fn()}
    />,
  );
  return { onSortModeChange };
};

const rowOrder = () =>
  ENVELOPES.map((e) => e.categorie).sort((a, b) =>
    screen.getByText(a).compareDocumentPosition(screen.getByText(b)) &
    Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1,
  );

describe('AnnualEnvelopesTab — tri', () => {
  it('trie par montant décroissant', () => {
    renderTab('montant');
    expect(rowOrder()).toEqual(['Vacances', 'Impôts', 'Assurance']);
  });

  it('trie par ordre alphabétique', () => {
    renderTab('alpha');
    expect(rowOrder()).toEqual(['Assurance', 'Impôts', 'Vacances']);
  });

  it("suit l'ordre manuel et affiche une poignée par enveloppe", () => {
    renderTab('manual', ['Impôts', 'Assurance', 'Vacances']);
    expect(rowOrder()).toEqual(['Impôts', 'Assurance', 'Vacances']);
    expect(screen.getAllByRole('button', { name: /Glisser pour réordonner/ })).toHaveLength(3);
  });

  it('change le mode de tri', () => {
    const { onSortModeChange } = renderTab('montant');
    fireEvent.click(screen.getByRole('button', { name: 'Alphabétique' }));
    expect(onSortModeChange).toHaveBeenCalledWith('alpha');
  });
});
