import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AuditSpec } from '../../../services/auditLog';
import { FusionPage } from '../FusionPage';

const auditedMock = vi.fn((_specs: AuditSpec[], write: () => Promise<unknown>) => write());
vi.mock('../../../services/auditLog', () => ({
  audited: (specs: AuditSpec[], write: () => Promise<unknown>) => auditedMock(specs, write),
}));

const batch = { update: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
const refs = [
  { id: 't1', path: 'transactions/t1' },
  { id: 't2', path: 'transactions/t2' },
];
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => 'ts'),
  getDocs: vi.fn(() => Promise.resolve({ docs: refs.map((ref) => ({ ref })) })),
  writeBatch: vi.fn(() => batch),
}));
vi.mock('../../../services/firebase', () => ({ db: {} }));
vi.mock('../../../utils/withRetry', () => ({ withRetry: (fn: () => Promise<unknown>) => fn() }));
vi.mock('../../../lib/confirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../../../context/TransactionContext', () => ({
  useTransactionContext: () => ({
    transactions: [
      { id: 't1', categorie: 'Divers' },
      { id: 't2', categorie: 'Divers' },
    ],
  }),
}));
vi.mock('../../../context/BudgetContext', () => ({
  useBudgetContext: () => ({ getBudgetCategoryCandidates: () => ['Courses'] }),
}));

describe('FusionPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('journalise une ligne par transaction recatégorisée', async () => {
    render(
      <MemoryRouter>
        <FusionPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Courses' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer (1)' }));

    await waitFor(() => expect(batch.commit).toHaveBeenCalledTimes(1));
    expect(batch.update).toHaveBeenCalledWith(refs[0], { categorie: 'Courses', updatedAt: 'ts' });
    expect(auditedMock.mock.calls[0]![0]).toEqual(
      refs.map((ref) => ({ domain: 'transaction', ref, patch: { categorie: 'Courses' } })),
    );
  });
});
