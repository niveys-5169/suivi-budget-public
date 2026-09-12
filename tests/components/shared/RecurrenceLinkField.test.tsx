import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecurrenceLinkField } from '../../../public/src/components/shared/RecurrenceLinkField';
import { useRecurrences } from '../../../public/src/hooks/useRecurrences';
import type { Recurrence, Transaction } from '../../../public/src/types/banking.types';

vi.mock('../../../public/src/hooks/useRecurrences', () => ({ useRecurrences: vi.fn() }));

const transaction = {
  id: 'tx-1',
  date: '2026-06-15',
  libelle: 'NETFLIX.COM',
  categorie: 'Abonnement',
  montant: -13.99,
  compte: 'LCL',
  pointe: false,
} as Transaction;

const rec = (over: Partial<Recurrence>): Recurrence =>
  ({
    id: 'rec-1',
    label: 'Netflix',
    category: 'Abonnement',
    expectedAmount: -13.99,
    active: true,
    ...over,
  }) as Recurrence;

const link = vi.fn().mockResolvedValue(undefined);
const unlink = vi.fn().mockResolvedValue(undefined);

function setup(candidates: Recurrence[], linkedTxToRecurrence: Record<string, Recurrence> = {}) {
  (useRecurrences as any).mockReturnValue({
    mappings: { linkedTxToRecurrence, candidateTxToRecurrence: {} },
    recurrenceCandidates: () => candidates,
    link,
    unlink,
  });
  return render(<RecurrenceLinkField transaction={transaction} />);
}

beforeEach(() => vi.clearAllMocks());

describe('RecurrenceLinkField', () => {
  it('analyse le mois de la transaction, pas le mois affiché', () => {
    setup([]);
    expect(useRecurrences).toHaveBeenCalledWith('2026-06');
  });

  it("retombe sur la date quand le mois d'affectation est absent", () => {
    (useRecurrences as any).mockReturnValue({
      mappings: { linkedTxToRecurrence: {}, candidateTxToRecurrence: {} },
      recurrenceCandidates: () => [],
      link,
      unlink,
    });
    render(<RecurrenceLinkField transaction={{ ...transaction, moisAffectation: '2026-07' }} />);
    expect(useRecurrences).toHaveBeenCalledWith('2026-07');
  });

  it('déplie la liste dans l’ordre fourni par la façade', () => {
    setup([rec({}), rec({ id: 'rec-2', label: 'Spotify', expectedAmount: -10 })]);

    fireEvent.click(screen.getByRole('button', { name: /lier à une récurrence/i }));

    const rows = screen
      .getAllByRole('button')
      .filter((b) => /Netflix|Spotify/.test(b.textContent ?? ''));
    expect(rows.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Netflix'),
      expect.stringContaining('Spotify'),
    ]);
  });

  it('lie la transaction persistée à la récurrence choisie', async () => {
    const target = rec({});
    setup([target]);

    fireEvent.click(screen.getByRole('button', { name: /lier à une récurrence/i }));
    fireEvent.click(screen.getByText('Netflix'));

    await waitFor(() => expect(link).toHaveBeenCalledWith(target, transaction));
    // La liste se referme : on repasse au bouton d'ouverture.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /lier à une récurrence/i })).toBeInTheDocument(),
    );
  });

  it('affiche la récurrence liée et permet de délier', async () => {
    const target = rec({});
    setup([], { 'tx-1': target });

    expect(screen.getByText(/Netflix/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /lier à une récurrence/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /délier/i }));
    await waitFor(() => expect(unlink).toHaveBeenCalledWith('rec-1', 'tx-1'));
  });

  it('annonce une liste vide plutôt qu’un panneau muet', () => {
    setup([]);
    fireEvent.click(screen.getByRole('button', { name: /lier à une récurrence/i }));
    expect(screen.getByText(/aucune récurrence disponible/i)).toBeInTheDocument();
  });
});
