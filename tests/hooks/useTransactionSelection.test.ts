import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionSelection } from '../../public/src/hooks/useTransactionSelection';

describe('useTransactionSelection', () => {
  it('starts inactive with an empty selection', () => {
    const { result } = renderHook(() => useTransactionSelection());
    expect(result.current.selectionMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggles selection mode on and off, clearing the selection when leaving', () => {
    const { result } = renderHook(() => useTransactionSelection());

    act(() => result.current.toggleSelectionMode());
    expect(result.current.selectionMode).toBe(true);

    act(() => result.current.toggleSelect('a'));
    expect(result.current.selectedIds.has('a')).toBe(true);

    act(() => result.current.toggleSelectionMode());
    expect(result.current.selectionMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggleSelect adds and removes ids', () => {
    const { result } = renderHook(() => useTransactionSelection());
    act(() => result.current.toggleSelect('x'));
    act(() => result.current.toggleSelect('y'));
    expect(result.current.selectedIds).toEqual(new Set(['x', 'y']));

    act(() => result.current.toggleSelect('x'));
    expect(result.current.selectedIds).toEqual(new Set(['y']));
  });

  it('selectAll replaces the selection and clear empties it', () => {
    const { result } = renderHook(() => useTransactionSelection());
    act(() => result.current.selectAll(['1', '2', '3']));
    expect(result.current.selectedIds).toEqual(new Set(['1', '2', '3']));

    act(() => result.current.clear());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('exitSelection leaves the mode and empties the selection', () => {
    const { result } = renderHook(() => useTransactionSelection());
    act(() => result.current.enterSelection());
    act(() => result.current.selectAll(['1', '2']));

    act(() => result.current.exitSelection());
    expect(result.current.selectionMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });
});
