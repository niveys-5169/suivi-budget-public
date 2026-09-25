import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useFinanceQA, ChatMessage } from '../../public/src/hooks/useFinanceQA';

const requestFullLoad = vi.fn();

vi.mock('../../public/src/hooks/useTransactions', () => ({
  useTransactions: () => ({ transactions: [], requestFullLoad }),
}));

vi.mock('../../public/src/hooks/useBudget', () => ({
  useBudget: () => ({ budgets: [] }),
}));

describe('useFinanceQA', () => {
  it('should initialize messages and slice history', () => {
    const { result } = renderHook(() => useFinanceQA());

    expect(result.current.initMessages).toBeDefined();

    const initialMsgs: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    act(() => {
      result.current.initMessages(initialMsgs);
    });

    expect(result.current.messages).toEqual(initialMsgs);
  });

  it("demande le chargement de tout l'historique des transactions", () => {
    renderHook(() => useFinanceQA());
    expect(requestFullLoad).toHaveBeenCalled();
  });
});
