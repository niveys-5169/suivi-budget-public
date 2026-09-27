import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setDoc } from 'firebase/firestore';
import { triggerGitHubWorkflow } from '../../../services/firebase-api';
import { ReparsePage } from '../ReparsePage';

type Snap = { docs: { id: string; data: () => Record<string, unknown> }[] };

const snapshots: Record<string, Snap> = {};
const snap = (rows: Record<string, unknown>[]): Snap => ({
  docs: rows.map(({ id, ...data }) => ({ id: String(id), data: () => data })),
});

vi.mock('../../../services/firebase', () => ({ db: {} }));
vi.mock('../../../services/firebase-api', () => ({ triggerGitHubWorkflow: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  query: (col: { name: string }) => col,
  orderBy: vi.fn(),
  limit: vi.fn(),
  doc: (_db: unknown, col: string, id: string) => ({ col, id }),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'ts'),
  onSnapshot: (ref: { name: string }, cb: (s: Snap) => void) => {
    cb(snapshots[ref.name] ?? snap([]));
    return () => {};
  },
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ReparsePage />
    </MemoryRouter>,
  );

describe('ReparsePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshots.gmail_messages = snap([{ id: 'm1', subject: 'Notification Linxo' }]);
    snapshots.reparse_jobs = snap([]);
    snapshots.gmail_excluded = snap([]);
    vi.mocked(triggerGitHubWorkflow).mockResolvedValue({ status: 'success' });
  });

  it('enregistre le job puis déclenche immédiatement le workflow import-linxo', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Reparser' }));

    await waitFor(() => expect(triggerGitHubWorkflow).toHaveBeenCalledWith('import-linxo'));
    expect(setDoc).toHaveBeenCalledWith(
      { col: 'reparse_jobs', id: 'm1' },
      expect.objectContaining({ messageId: 'm1', status: 'requested' }),
      { merge: true },
    );
  });

  it('déclenche aussi le workflow pour le scan complet', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Scanner tout' }));

    await waitFor(() => expect(triggerGitHubWorkflow).toHaveBeenCalledWith('import-linxo'));
    expect(setDoc).toHaveBeenCalledWith(
      { col: 'reparse_jobs', id: 'full_scan_request' },
      expect.objectContaining({ status: 'requested' }),
      { merge: true },
    );
  });

  it('affiche le statut et le résultat du job de reparse du mail', () => {
    snapshots.reparse_jobs = snap([
      { id: 'm1', status: 'done', resultMessage: '2 transaction(s) réimportée(s).' },
    ]);
    renderPage();

    expect(screen.getByText('Reparse : done')).toBeInTheDocument();
    expect(screen.getByText('2 transaction(s) réimportée(s).')).toBeInTheDocument();
  });
});
