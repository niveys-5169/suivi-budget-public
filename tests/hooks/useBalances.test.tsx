import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useBalances } from '../../public/src/hooks/useBalances';
import { useGlobalData } from '../../public/src/context/GlobalDataContext';

vi.mock('../../public/src/context/GlobalDataContext', () => ({
  useGlobalData: vi.fn(),
}));

describe('useBalances Regression', () => {
  it('should consume data from GlobalDataContext', () => {
    const mockBalances = [{ id: '1', compte: 'LCL', current_balance: 5000 }];
    (useGlobalData as any).mockReturnValue({
      accountBalances: mockBalances,
      loading: false,
    });

    const { result } = renderHook(() => useBalances());
    expect(result.current.balances).toEqual(mockBalances);
    expect(result.current.loading).toBe(false);
  });
});
