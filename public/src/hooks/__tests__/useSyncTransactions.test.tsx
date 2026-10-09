import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncTransactions } from '../useSyncTransactions';
import { syncBanking } from '../../services/banking-api';
import { toast } from '../../lib/toast';

vi.mock('../../services/banking-api', () => ({ syncBanking: vi.fn() }));
vi.mock('../../lib/toast', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

describe('synchronisation suivie jusqu’au résultat', () => {
  beforeEach(() => vi.clearAllMocks());
  it('confirme la réussite même si aucune nouvelle opération n’arrive', async () => {
    vi.mocked(syncBanking).mockResolvedValue({ id: 'run', status: 'success', imported: 0 });
    const { result } = renderHook(() => useSyncTransactions());
    await act(() => result.current.sync());
    expect(toast.success).toHaveBeenCalledOnce();
    expect(result.current.isSyncing).toBe(false);
  });
  it('affiche une réussite partielle et permet une nouvelle tentative', async () => {
    vi.mocked(syncBanking).mockResolvedValue({
      id: 'run',
      status: 'partial',
      sources: { bank: 'EXPIRED_SESSION', linxo: 'success' },
    });
    const { result } = renderHook(() => useSyncTransactions());
    await act(() => result.current.sync());
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('partielle'), 6000);
    await act(() => result.current.sync());
    expect(syncBanking).toHaveBeenCalledTimes(2);
  });
  it('empêche le double déclenchement pendant une exécution', async () => {
    let finish!: (value: { id: string; status: 'success' }) => void;
    vi.mocked(syncBanking).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useSyncTransactions());
    let execution: Promise<void>;
    act(() => {
      execution = result.current.sync();
    });
    await act(() => result.current.sync());
    expect(syncBanking).toHaveBeenCalledOnce();
    await act(async () => {
      finish({ id: 'run', status: 'success' });
      await execution;
    });
    expect(result.current.isSyncing).toBe(false);
  });
});
