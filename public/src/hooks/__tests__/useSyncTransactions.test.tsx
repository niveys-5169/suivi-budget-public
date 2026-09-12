import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncTransactions } from '../useSyncTransactions';
import { useGlobalData } from '../../context/GlobalDataContext';
import { useTransactionContext } from '../../context/TransactionContext';
import { triggerGitHubWorkflow } from '../../services/firebase-api';
import type { AccountBalance } from '../../types/balances';

vi.mock('../../context/GlobalDataContext', () => ({
  useGlobalData: vi.fn(),
}));
vi.mock('../../context/TransactionContext', () => ({
  useTransactionContext: vi.fn(),
}));
vi.mock('../../services/firebase-api', () => ({
  triggerGitHubWorkflow: vi.fn(),
}));

// Override the global react-intl mock to perform ICU placeholder substitution
// — needed to verify the discrepancy toast message contains the account name
// and formatted ecart.
vi.mock('react-intl', async () => {
  const { default: frMessages } = await import('../../i18n/messages/fr');
  const substitute = (template: string, values?: Record<string, unknown>) => {
    if (!values) return template;
    return Object.entries(values).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
      template,
    );
  };
  return {
    useIntl: () => ({
      formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
        substitute((frMessages as Record<string, string>)[id] ?? id, values),
    }),
  };
});

type BalanceOverrides = Partial<AccountBalance> & { updatedAtMs?: number; ecart?: number };

const makeBalance = (overrides: BalanceOverrides): AccountBalance => {
  const { updatedAtMs, ...rest } = overrides;
  return {
    id: rest.compte ?? 'TestAcct',
    compte: rest.compte ?? 'TestAcct',
    current_balance: 0,
    source: 'gmail',
    source_timestamp: null,
    status: 'reconciled',
    ...(updatedAtMs !== undefined
      ? { updatedAt: { toMillis: () => updatedAtMs } as unknown as null }
      : {}),
    ...rest,
  } as AccountBalance;
};

const useGlobalDataMock = useGlobalData as unknown as ReturnType<typeof vi.fn>;
const useTransactionContextMock = useTransactionContext as unknown as ReturnType<typeof vi.fn>;
const triggerGitHubWorkflowMock = triggerGitHubWorkflow as unknown as ReturnType<typeof vi.fn>;

describe('useSyncTransactions — discrepancy warning at import', () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    triggerGitHubWorkflowMock.mockResolvedValue({ status: 'success' });
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    useTransactionContextMock.mockReturnValue({ transactions: [] });
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  type ToastDetail = { type: string; message: string; duration: number; id?: string };
  const toastEvents = (): ToastDetail[] =>
    dispatchSpy.mock.calls
      .map(([ev]: [Event]) => ev)
      .filter((ev: Event) => ev.type === 'show-toast')
      .map((ev: Event) => (ev as CustomEvent).detail as ToastDetail);

  it('does not emit a discrepancy warning when no balance flips to pending_review', async () => {
    const initial: AccountBalance[] = [
      makeBalance({ compte: 'BforBank', status: 'reconciled', updatedAtMs: 1000 }),
    ];
    useGlobalDataMock.mockReturnValue({ accountBalances: initial });

    const { result, rerender } = renderHook(() => useSyncTransactions());

    await act(async () => {
      await result.current.sync();
    });

    // Simulate a new transaction arriving without any balance status change.
    useTransactionContextMock.mockReturnValue({ transactions: [{}] });
    useGlobalDataMock.mockReturnValue({
      accountBalances: [
        makeBalance({ compte: 'BforBank', status: 'reconciled', updatedAtMs: 2000 }),
      ],
    });

    await act(async () => {
      rerender();
    });

    const toasts = toastEvents();
    expect(toasts.some((toast) => toast.id === 'sync-discrepancy')).toBe(false);
    expect(toasts.some((toast) => toast.type === 'success')).toBe(true);
  });

  it('emits a persistent error toast when a balance flips to pending_review during import', async () => {
    const initial: AccountBalance[] = [
      makeBalance({ compte: 'BforBank', status: 'reconciled', updatedAtMs: 1000, ecart: 0 }),
    ];
    useGlobalDataMock.mockReturnValue({ accountBalances: initial });

    const { result, rerender } = renderHook(() => useSyncTransactions());

    await act(async () => {
      await result.current.sync();
    });

    useTransactionContextMock.mockReturnValue({ transactions: [{}] });
    useGlobalDataMock.mockReturnValue({
      accountBalances: [
        makeBalance({
          compte: 'BforBank',
          status: 'pending_review',
          updatedAtMs: 2000,
          ecart: -3.42,
        }),
      ],
    });

    await act(async () => {
      rerender();
    });

    const toasts = toastEvents();
    const warning = toasts.find((toast) => toast.id === 'sync-discrepancy');
    expect(warning).toBeDefined();
    expect(warning?.type).toBe('error');
    expect(warning?.duration).toBe(0);
    expect(warning?.message).toContain('BforBank');
    expect(warning?.message).toContain('-3,42');
  });
});
