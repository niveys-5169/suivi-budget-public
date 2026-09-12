import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { AurumRecurringPage } from '../../../../public/src/components/dashboard/v2/AurumRecurringPage';
import { TransactionContext } from '../../../../public/src/context/TransactionContext';
import React from 'react';

beforeEach(() => {
  vi.useRealTimers();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-20'));
  vi.clearAllMocks();
  mockTransactionContextValue.transactions = [];
});

const mockRecurrences = [
  {
    id: 'r-loyer',
    label: 'Loyer',
    category: 'Logement',
    expectedAmount: -900,
    anchorDate: '2026-06-05',
    active: true,
  },
  {
    id: 'r-netflix',
    label: 'Abonnement Netflix',
    category: 'Loisirs',
    expectedAmount: -15,
    anchorDate: '2026-06-20',
    active: true,
  },
  {
    id: 'r-electricite',
    label: 'Électricité',
    category: 'Logement',
    expectedAmount: -60,
    anchorDate: '2026-06-12',
    active: true,
  },
];

vi.mock('../../../../public/src/context/GlobalDataContext', () => ({
  useGlobalData: () => ({ recurrences: mockRecurrences }),
}));

const recurrencesService = vi.hoisted(() => ({
  approveRecurrenceMatch: vi.fn(),
  addRecurrenceAlias: vi.fn(),
  removeRecurrence: vi.fn(),
  setRecurrenceActive: vi.fn(),
  skipRecurrencePeriod: vi.fn(),
  unapproveRecurrenceMonth: vi.fn(),
  unlinkRecurrenceTx: vi.fn(),
  unskipRecurrencePeriod: vi.fn(),
  updateRecurrence: vi.fn(),
}));
vi.mock('../../../../public/src/hooks/recurrencesService', () => recurrencesService);

const mockTransactionContextValue = {
  transactions: [] as unknown[],
  togglePointe: vi.fn(),
  bulkUpdate: vi.fn(),
};

function renderPage() {
  return render(
    <TransactionContext.Provider value={mockTransactionContextValue as any}>
      <AurumRecurringPage onBack={vi.fn()} />
    </TransactionContext.Provider>,
  );
}

function getPendingLabels() {
  const section = screen.getByText(/^En attente \(/).closest('section') as HTMLElement;
  return within(section)
    .getAllByText(/Loyer|Abonnement Netflix|Électricité/)
    .map((el) => el.textContent);
}

describe('AurumRecurringPage — tri', () => {
  it('trie par date (jour du mois) croissant par défaut', () => {
    renderPage();
    expect(getPendingLabels()).toEqual(['Loyer', 'Électricité', 'Abonnement Netflix']);
  });

  it('trie par montant croissant puis inverse au second clic', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^Montant$/i }));
    expect(getPendingLabels()).toEqual(['Abonnement Netflix', 'Électricité', 'Loyer']);

    fireEvent.click(screen.getByRole('button', { name: /^Montant$/i }));
    expect(getPendingLabels()).toEqual(['Loyer', 'Électricité', 'Abonnement Netflix']);
  });

  it('trie par libellé alphabétique', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^Libellé$/i }));
    expect(getPendingLabels()).toEqual(['Abonnement Netflix', 'Électricité', 'Loyer']);
  });
});

describe('AurumRecurringPage — suppression', () => {
  it('supprime depuis la fiche d’édition (atteignable au tactile)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    // Ouvre la fiche via le crayon (toujours visible, pas de survol requis).
    const label = screen.getByText('Loyer');
    const row = label.closest('div')!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(row).getByTitle(/Modifier/i));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Supprimer cette récurrence/i }));
    });

    expect(recurrencesService.removeRecurrence).toHaveBeenCalledWith('r-loyer');
    confirmSpy.mockRestore();
  });
});

describe('AurumRecurringPage — archivées', () => {
  it('rend les récurrences en pause et permet réactivation + suppression', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockRecurrences.push({
      id: 'r-gym',
      label: 'Salle de sport',
      category: 'Loisirs',
      expectedAmount: -40,
      anchorDate: '2026-06-10',
      active: false,
    });

    try {
      renderPage();

      // Déplier la section « Archivées ».
      fireEvent.click(screen.getByText(/^Archivées \(/));
      const section = screen.getByText(/^Archivées \(/).closest('section') as HTMLElement;
      expect(within(section).getByText('Salle de sport')).toBeTruthy();

      fireEvent.click(within(section).getByTitle('Réactiver la récurrence'));
      expect(recurrencesService.setRecurrenceActive).toHaveBeenCalledWith('r-gym', true);

      await act(async () => {
        fireEvent.click(within(section).getByTitle('Supprimer la récurrence'));
      });
      expect(recurrencesService.removeRecurrence).toHaveBeenCalledWith('r-gym');
    } finally {
      mockRecurrences.pop();
      confirmSpy.mockRestore();
    }
  });
});

describe('AurumRecurringPage — liaison manuelle', () => {
  it('propose et lie une transaction qui ne matche pas automatiquement', async () => {
    // Ne matche pas r-electricite (catégorie et montant différents) : reste
    // "en attente" mais doit tout de même apparaître dans les candidats — le
    // rattachement manuel est volontairement permissif.
    const candidate = {
      id: 'tx-99',
      libelle: 'Prélèvement inconnu',
      categorie: 'Autre',
      montant: -999,
      date: '2026-06-15',
      pointe: false,
    };
    mockTransactionContextValue.transactions = [candidate];

    renderPage();

    const label = screen.getByText('Électricité');
    const row = label.closest('div')!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(row).getByTitle('Lier à une transaction'));

    await act(async () => {
      fireEvent.click(screen.getByText('Prélèvement inconnu'));
    });

    expect(recurrencesService.approveRecurrenceMatch).toHaveBeenCalledWith(
      'r-electricite',
      '2026-06',
      expect.objectContaining({ id: 'tx-99' }),
    );
    expect(recurrencesService.addRecurrenceAlias).toHaveBeenCalledWith(
      'r-electricite',
      'Prélèvement inconnu',
    );
  });
});
