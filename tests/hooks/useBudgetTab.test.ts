import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBudgetTab } from '../../public/src/hooks/useBudgetTab';

describe('useBudgetTab', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('« budgets » par défaut, puis mémorise le choix', () => {
    const { result, unmount } = renderHook(() => useBudgetTab());
    expect(result.current.tab).toBe('budgets');

    act(() => result.current.setTab('enveloppes'));
    expect(result.current.tab).toBe('enveloppes');
    unmount();

    expect(renderHook(() => useBudgetTab()).result.current.tab).toBe('enveloppes');
  });

  it('fonctionne sans stockage disponible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const { result } = renderHook(() => useBudgetTab());
    expect(result.current.tab).toBe('budgets');
    act(() => result.current.setTab('enveloppes'));
    expect(result.current.tab).toBe('enveloppes');
  });
});
