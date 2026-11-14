import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetProvider, useBudgetContext } from '../../public/src/context/BudgetContext';
import { AppStateProvider } from '../../public/src/context/AppStateContext';
import { createBudget, deleteBudget, updateBudget } from '../../public/src/api/budgets';

const auditedMergeMock = vi.fn().mockResolvedValue(undefined);
const auditedMock = vi.fn((_spec: unknown, write: () => Promise<unknown>) => write());
vi.mock('../../public/src/services/auditLog', () => ({
  auditedMerge: (...args: unknown[]) => auditedMergeMock(...args),
  audited: (spec: unknown, write: () => Promise<unknown>) => auditedMock(spec, write),
}));
vi.mock('../../public/src/services/firebase', () => ({ db: {} }));
vi.mock('../../public/src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-user' }, loading: false }),
}));
vi.mock('../../public/src/utils/withRetry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));
const deleteDocMock = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  query: vi.fn(),
  doc: vi.fn((_db, coll, id) => ({ id, path: `${coll}/${id}` })),
  setDoc: vi.fn(),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  serverTimestamp: vi.fn(() => 'ts'),
  deleteField: vi.fn(() => 'del'),
}));

const Buttons = () => {
  const ctx = useBudgetContext();
  const year = ctx.monthKey.split('-')[0];
  return (
    <div>
      <span data-testid="month">{ctx.monthKey}</span>
      <span data-testid="year">{year}</span>
      <button onClick={() => ctx.updateMonthlyBudget('Loisirs', 100)}>mensuel</button>
      <button onClick={() => ctx.updateAnnualDefault('Loisirs', 1200)}>annuel</button>
      <button onClick={() => ctx.updateBaseBudget('Loisirs', 90)}>base</button>
      <button onClick={() => ctx.removeBudgetCategory('Loisirs')}>supprimer</button>
    </div>
  );
};

const click = (name: string) => act(async () => screen.getByText(name).click());

describe('journal des budgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    render(
      <AppStateProvider>
        <BudgetProvider>
          <Buttons />
        </BudgetProvider>
      </AppStateProvider>,
    );
  });

  it('budget du mois : libellé « catégorie (mois) »', async () => {
    const month = screen.getByTestId('month').textContent;
    await click('mensuel');
    const [domain, ref, data, label] = auditedMergeMock.mock.calls[0]!;
    expect(domain).toBe('budget');
    expect(ref.path).toContain('budgets_monthly/');
    expect(data).toMatchObject({ categorie: 'Loisirs', montant: 100, month });
    expect(label).toBe(`Loisirs (${month})`);
  });

  it('budget annuel et budget de base', async () => {
    await click('annuel');
    expect(auditedMergeMock.mock.calls[0]![3]).toBe(
      `Loisirs (${screen.getByTestId('year').textContent})`,
    );
    await click('base');
    const [, ref, data, label] = auditedMergeMock.mock.calls[1]!;
    expect(ref.path).toContain('budgets/');
    expect(data).toMatchObject({ categorie: 'Loisirs', montant: 90 });
    expect(label).toBe('Loisirs');
  });

  it('suppression d’un budget', async () => {
    await click('supprimer');
    expect(auditedMock.mock.calls[0]![0]).toMatchObject({
      domain: 'budget',
      action: 'delete',
      label: 'Loisirs',
      keep: ['montant', 'type'],
    });
    expect(auditedMergeMock).not.toHaveBeenCalled();
  });

  it('suppression refusée : la désactivation de repli est consignée comme une modification', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    deleteDocMock.mockRejectedValueOnce(new Error('refusé'));
    await click('supprimer');
    const [domain, ref, data, label] = auditedMergeMock.mock.calls[0]!;
    expect(domain).toBe('budget');
    expect(ref.path).toBe('budgets/Loisirs');
    expect(data).toMatchObject({ categorie: 'Loisirs', actif: false });
    expect(label).toBe('Loisirs');
  });
});

describe('journal des budgets (api)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('création et modification', async () => {
    await createBudget({ categorie: 'Courses', montant: 300 });
    expect(auditedMock.mock.calls[0]![0]).toMatchObject({
      domain: 'budget',
      ref: { id: 'Courses', path: 'budgets/Courses' },
      action: 'create',
      patch: { categorie: 'Courses', montant: 300 },
    });

    await updateBudget('courses', { montant: 350 });
    expect(auditedMergeMock.mock.calls[0]![1]).toEqual({ id: 'courses', path: 'budgets/courses' });
    expect(auditedMergeMock.mock.calls[0]![2]).toMatchObject({ montant: 350 });
  });

  it('suppression', async () => {
    await deleteBudget('courses');
    expect(auditedMock.mock.calls[0]![0]).toEqual({
      domain: 'budget',
      ref: { id: 'courses', path: 'budgets/courses' },
      action: 'delete',
      keep: ['montant', 'type'],
    });
  });
});
