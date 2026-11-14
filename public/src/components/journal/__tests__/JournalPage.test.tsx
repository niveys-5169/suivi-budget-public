import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JournalPage } from '../JournalPage';
import { TransactionAuditTrail } from '../TransactionAuditTrail';
import type { AuditEntry } from '../../../types/banking.types';

const entry = (overrides: Partial<AuditEntry>): AuditEntry => ({
  id: 'e1',
  at: new Date(2026, 10, 14, 9, 30),
  byEmail: 'invite@example.com',
  domain: 'transaction',
  action: 'update',
  path: 'transactions/t1',
  docId: 't1',
  label: 'CB CARREFOUR',
  changes: [{ field: 'categorie', from: 'Divers', to: 'Courses' }],
  ...overrides,
});

let mockEntries: AuditEntry[] = [];
let mockLoading = false;
let mockError = false;
const useAuditLogMock = vi.fn((_max: number) => ({
  entries: mockEntries,
  loading: mockLoading,
  error: mockError,
}));
let mockDocEntries: AuditEntry[] = [];
vi.mock('../../../hooks/useAuditLog', () => ({
  PAGE_SIZE: 200,
  useAuditLog: (max: number) => useAuditLogMock(max),
  useDocumentAudit: () => mockDocEntries,
}));

describe('JournalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoading = false;
    mockError = false;
    mockEntries = [
      entry({}),
      entry({
        id: 'e2',
        byEmail: 'owner@example.com',
        domain: 'budget',
        label: 'Loisirs (2026-11)',
        changes: [{ field: 'montant', from: 100, to: 120 }],
      }),
      entry({ id: 'e3', domain: 'recurrence', action: 'delete', label: 'Netflix', changes: [] }),
    ];
  });

  it('liste qui a changé quoi et quand', () => {
    render(<JournalPage />);
    const row = screen.getByText('CB CARREFOUR').closest('li')!;
    expect(within(row).getByText('Catégorie : Divers → Courses')).toBeInTheDocument();
    expect(within(row).getByText(/invite@example\.com · 14\/11\/2026/)).toBeInTheDocument();
    expect(within(row).getByText('Transaction')).toBeInTheDocument();
    expect(screen.getByText('Suppression')).toBeInTheDocument();
  });

  it('filtre par personne et par domaine', () => {
    render(<JournalPage />);
    fireEvent.change(screen.getByLabelText('Filtrer par personne'), {
      target: { value: 'owner@example.com' },
    });
    expect(screen.queryByText('CB CARREFOUR')).not.toBeInTheDocument();
    expect(screen.getByText('Loisirs (2026-11)')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filtrer par domaine'), {
      target: { value: 'recurrence' },
    });
    expect(screen.getByText('Aucune modification pour ces filtres')).toBeInTheDocument();
  });

  it('journal vide', () => {
    mockEntries = [];
    render(<JournalPage />);
    expect(screen.getByText('Aucune modification enregistrée')).toBeInTheDocument();
  });

  it('« Voir plus » charge 200 lignes de plus quand la page est pleine', () => {
    mockEntries = Array.from({ length: 200 }, (_, i) => entry({ id: `e${i}` }));
    render(<JournalPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Voir plus' }));
    expect(useAuditLogMock).toHaveBeenLastCalledWith(400);
  });

  it('« Voir plus » reste disponible quand les filtres ne gardent rien d’une page pleine', () => {
    mockEntries = Array.from({ length: 200 }, (_, i) => entry({ id: `e${i}` }));
    render(<JournalPage />);
    fireEvent.change(screen.getByLabelText('Filtrer par domaine'), {
      target: { value: 'recurrence' },
    });
    expect(screen.getByText('Aucune modification pour ces filtres')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voir plus' }));
    expect(useAuditLogMock).toHaveBeenLastCalledWith(400);
  });

  it('erreur de lecture : journal indisponible, pas journal vide', () => {
    mockEntries = [];
    mockError = true;
    render(<JournalPage />);
    expect(screen.getByText('Journal indisponible')).toBeInTheDocument();
    expect(screen.queryByText('Aucune modification enregistrée')).not.toBeInTheDocument();
  });

  it('pas de « Voir plus » quand tout est affiché', () => {
    render(<JournalPage />);
    expect(screen.queryByRole('button', { name: 'Voir plus' })).not.toBeInTheDocument();
  });
});

describe('TransactionAuditTrail', () => {
  it('rappelle les trois dernières modifications de la transaction', () => {
    mockDocEntries = [1, 2, 3, 4].map((i) =>
      entry({ id: `e${i}`, changes: [{ field: 'commentaire', to: `note ${i}` }] }),
    );
    render(<TransactionAuditTrail txId="t1" />);
    expect(screen.getByText('Dernières modifications')).toBeInTheDocument();
    expect(screen.getByText('Commentaire : note 1')).toBeInTheDocument();
    expect(screen.getByText('Commentaire : note 3')).toBeInTheDocument();
    expect(screen.queryByText('Commentaire : note 4')).not.toBeInTheDocument();
  });

  it("n'affiche rien sans modification journalisée", () => {
    mockDocEntries = [];
    const { container } = render(<TransactionAuditTrail txId="t1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
