import { describe, it, expect } from 'vitest';
import { computeBankingAlerts } from '../../public/src/utils/computeBankingAlerts';
import { normalizeTransaction } from '../../public/src/services/transactionRepository';
import { computeDerivedRav } from '../../public/src/utils/ravCalculations';
import type {
  BankConnection,
  BankReconciliationReport,
} from '../../public/src/types/banking.types';

const now = Date.parse('2026-10-09T08:00:00Z');
const conn: BankConnection = {
  id: 'c',
  bank: 'LCL',
  ownerUid: 'owner',
  status: 'active',
  accounts: [{ stableId: 'a', name: 'Courant', currency: 'EUR', compte: 'LCL', enabled: true }],
  validUntil: new Date(now + 5 * 86400000),
  lastSuccessAt: new Date(now),
};

describe('contrôles bancaires', () => {
  it('ne signale pas une source explicitement désactivée', () => {
    expect(
      computeBankingAlerts(
        [{ ...conn, mode: 'disabled', validUntil: new Date(now - 1) }],
        [
          {
            id: 'balance',
            monitoringEnabled: false,
            status: 'waiting',
            firstUnresolvedAt: new Date(now - 10 * 86400000),
          },
        ],
        now,
      ),
    ).toEqual([]);
  });
  it('sépare le préavis d’expiration de la reconnexion nécessaire', () => {
    expect(computeBankingAlerts([conn], [], now)[0]?.type).toBe('warning');
    expect(
      computeBankingAlerts([{ ...conn, validUntil: new Date(now - 1) }], [], now)[0]?.type,
    ).toBe('error');
  });
  it('signale une panne technique et la fraîcheur sans confondre les épisodes', () => {
    const failed = {
      ...conn,
      status: 'temporary_error' as const,
      errorCode: 'NETWORK_ERROR',
      errorSince: new Date(now),
      lastSuccessAt: new Date(now - 37 * 3600000),
    };
    const alerts = computeBankingAlerts([failed], [], now);
    expect(alerts.map((a) => a.id)).toEqual(['bank-error-c', 'bank-stale-c']);
    expect(new Set(alerts.map((a) => a.episodeKey)).size).toBe(2);
  });
  it('un rapprochement tardif supprime l’alerte Linxo, indépendamment du solde', () => {
    const report: BankReconciliationReport = {
      id: 'reconciliation',
      missing: [
        { id: 'e', compte: 'LCL', libelle: 'Café', firstBookedAt: new Date(now - 8 * 86400000) },
      ],
    };
    expect(
      computeBankingAlerts([], [report, { id: 'balance', status: 'concordant' }], now),
    ).toHaveLength(1);
    expect(computeBankingAlerts([], [{ ...report, missing: [] }], now)).toHaveLength(0);
  });
  it('normalise les champs facultatifs et compte une provisoire sans pointage', () => {
    const tx = normalizeTransaction({
      id: 'e',
      date: '2026-10-01',
      compte: 'LCL',
      libelle: 'Café',
      montant: -42,
      source: 'enable_banking',
      bankStatus: 'pending',
      linxoStatus: 'waiting',
      enAttente: true,
      pointe: false,
    });
    expect(tx?.enAttente).toBe(true);
    expect(tx?.linxoStatus).toBe('waiting');
    const result = computeDerivedRav(
      {
        revenu_mensuel_net: null,
        revenu_categories: [],
        depense_categories: [],
        included_accounts: [],
        provision_salaires: {},
      },
      { monthKey: '2026-10', txList: tx ? [tx] : [], recurrences: [] },
    );
    expect(result.totalDep).toBe(-42);
    expect(
      computeDerivedRav(
        {
          revenu_mensuel_net: null,
          revenu_categories: [],
          depense_categories: [],
          included_accounts: [],
          provision_salaires: {},
        },
        {
          monthKey: '2026-10',
          txList: tx ? [{ ...tx, bankStatus: 'cancelled' }] : [],
          recurrences: [],
        },
      ).totalDep,
    ).toBe(0);
  });
});
