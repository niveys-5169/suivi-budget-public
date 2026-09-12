import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useBudget } from '../../public/src/hooks/useBudget';

// Mock store.js import if needed or handle dependency injection
vi.mock('../services/firebase', () => ({
  db: {}, // Mocked db
}));

// Mock the context provider
vi.mock('../../public/src/context/BudgetContext', () => ({
  useBudgetContext: () => ({
    viewMode: 'monthly',
    setViewMode: vi.fn(),
    monthKey: '2026-04',
    setMonthKey: vi.fn(),
    budgets: [],
    loading: false,
    refresh: vi.fn(),
    getBudgetCategoryCandidates: vi.fn(() => []),
  }),
}));

describe('useBudget', () => {
  it('should initialize with default state', () => {
    // We don't necessarily need a real Provider if we mock the hook that consumes it
    const { result } = renderHook(() => useBudget());
    expect(result.current.budgets).toBeDefined();
  });
});
