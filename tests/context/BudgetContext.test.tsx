import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetProvider, useBudgetContext } from '../../public/src/context/BudgetContext';
import { AppStateProvider, useAppState } from '../../public/src/context/AppStateContext';
import { setDoc } from 'firebase/firestore';

// Mock Firebase and Auth
vi.mock('../../public/src/services/firebase', () => ({
  db: {},
}));

vi.mock('../../public/src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-user' }, loading: false }),
}));

// Mock Firestore functions
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn((_query, _callback) => {
    return () => {};
  }),
  query: vi.fn(),
  doc: vi.fn((db, coll, id) => ({ id })),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  deleteDoc: vi.fn(),
}));

const TestComponent = () => {
  const { monthKey, updateMonthlyBudget } = useBudgetContext();
  const { setMonthKey } = useAppState();

  return (
    <div>
      <div data-testid="month">{monthKey}</div>
      <button data-testid="shift" onClick={() => setMonthKey('2026-05')}>
        Shift to May
      </button>
      <button data-testid="save" onClick={() => updateMonthlyBudget('Loisirs', 100)}>
        Save
      </button>
    </div>
  );
};

describe('BudgetContext Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should use the synchronized monthKey from AppStateContext when updating budget', async () => {
    render(
      <AppStateProvider>
        <BudgetProvider>
          <TestComponent />
        </BudgetProvider>
      </AppStateProvider>,
    );

    // Initial month should be current month (e.g., 2026-04 if today is April 2026)
    // We don't hardcode it to 2026-04 to avoid test failure if month changes, but we know it's something.
    const initialMonth = screen.getByTestId('month').textContent;
    expect(initialMonth).toMatch(/^\d{4}-\d{2}$/);

    // Change month via AppState
    await act(async () => {
      screen.getByTestId('shift').click();
    });

    expect(screen.getByTestId('month').textContent).toBe('2026-05');

    // Save budget
    await act(async () => {
      screen.getByTestId('save').click();
    });

    // Verify setDoc was called with correct ID (containing 2026-05)
    expect(setDoc).toHaveBeenCalled();
    const call = vi.mocked(setDoc).mock.calls[0]!;
    const docRef = call[0]! as any;
    expect(docRef.id).toContain('2026-05');
    expect(docRef.id).toContain('Loisirs');
  });
});
