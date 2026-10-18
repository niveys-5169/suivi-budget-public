import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardReconciliation } from '../useKeyboardReconciliation';
import type { Transaction } from '../../types/banking.types';

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    libelle: 'Achat 1',
    montant: -50,
    date: '2026-10-15',
    pointe: false,
    compte: 'Courant',
  },
  {
    id: 'tx-2',
    libelle: 'Achat 2',
    montant: -30,
    date: '2026-10-16',
    pointe: false,
    compte: 'Courant',
  },
  {
    id: 'tx-3',
    libelle: 'Achat 3',
    montant: -20,
    date: '2026-10-17',
    pointe: true,
    compte: 'Courant',
  },
];

describe('useKeyboardReconciliation', () => {
  it('navigue vers le bas avec selectNext ou touche j / ArrowDown', () => {
    const onTogglePointe = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardReconciliation({
        transactions: mockTransactions,
        onTogglePointe,
      }),
    );

    expect(result.current.selectedIndex).toBe(-1);

    act(() => {
      result.current.selectNext();
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedTxId).toBe('tx-1');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });
    expect(result.current.selectedIndex).toBe(1);
    expect(result.current.selectedTxId).toBe('tx-2');
  });

  it('navigue vers le haut avec selectPrev ou touche k / ArrowUp', () => {
    const onTogglePointe = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardReconciliation({
        transactions: mockTransactions,
        onTogglePointe,
      }),
    );

    act(() => {
      result.current.setSelectedIndex(2);
    });
    expect(result.current.selectedIndex).toBe(2);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    });
    expect(result.current.selectedIndex).toBe(1);
    expect(result.current.selectedTxId).toBe('tx-2');
  });

  it('bascule le pointage et avance automatiquement sur Espace', () => {
    const onTogglePointe = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardReconciliation({
        transactions: mockTransactions,
        onTogglePointe,
      }),
    );

    act(() => {
      result.current.setSelectedIndex(0);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });

    // Devrait avoir appelé onTogglePointe avec l'ID tx-1 et pointe true (!false)
    expect(onTogglePointe).toHaveBeenCalledWith('tx-1', true);
    // Devrait avoir avancé à l'index suivant (1)
    expect(result.current.selectedIndex).toBe(1);
  });

  it('réinitialise la sélection sur Escape', () => {
    const onTogglePointe = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardReconciliation({
        transactions: mockTransactions,
        onTogglePointe,
      }),
    );

    act(() => {
      result.current.setSelectedIndex(1);
    });
    expect(result.current.selectedIndex).toBe(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selectedTxId).toBeNull();
  });
});
