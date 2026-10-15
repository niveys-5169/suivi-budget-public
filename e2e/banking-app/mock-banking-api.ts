import type {
  BankConnection,
  BankReconciliationReport,
  BankSyncResult,
} from '../../public/src/types/banking.types';

export const fixture = {
  connections: [
    {
      id: 'c',
      bank: 'LCL',
      ownerUid: 'test',
      mode: 'active',
      status: 'reconnect',
      errorCode: 'EXPIRED_SESSION',
      validUntil: new Date(Date.now() - 1000),
      createdAt: new Date(),
      accounts: [{ stableId: 'a', name: 'Courant', compte: 'LCL', currency: 'EUR', enabled: true }],
    },
  ] as BankConnection[],
  reports: [
    {
      id: 'reconciliation',
      suggestions: [
        {
          enableObservationId: 'e',
          linxoObservationId: 'l',
          compte: 'LCL',
          enableLabel: 'CAFE PARIS',
          linxoLabel: 'CARTE CAFE',
          montant: -42,
        },
      ],
      matches: [],
      missing: [],
    },
  ] as BankReconciliationReport[],
  status: 'waiting' as 'waiting' | 'matched',
  runs: 0,
};
export const events = new EventTarget();
const change = () => events.dispatchEvent(new Event('change'));
export async function bankCall<T>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  if (name === 'eb_list_banks')
    return { banks: [{ name: 'LCL', country: 'FR' }], mode: 'active' } as T;
  if (name === 'eb_auth_start') return { url: 'https://bank.test/authorize' } as T;
  if (name === 'eb_save_mapping') {
    change();
    return { status: 'success', ...data } as T;
  }
  throw new Error('Unknown simulated operation');
}
export async function syncBanking(): Promise<BankSyncResult> {
  fixture.runs += 1;
  change();
  return { id: `run-${fixture.runs}`, status: 'success', imported: 0 };
}
