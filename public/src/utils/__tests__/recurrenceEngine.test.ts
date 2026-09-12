import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  getApprovalEntries,
  getApprovalAmount,
  getApprovedTxIds,
  computePeriodState,
} from '../recurrenceEngine';
import type { Recurrence, RecurrenceApproval } from '../../types/banking.types';

const legacyApproval: RecurrenceApproval = {
  txId: 'tx-1',
  amount: -1200,
  date: '2026-06-02',
  approvedAt: 111,
};

const multiApproval: RecurrenceApproval = {
  txId: 'tx-1',
  amount: -1200,
  date: '2026-06-02',
  approvedAt: 111,
  entries: [
    { txId: 'tx-1', amount: -1200, date: '2026-06-02' },
    { txId: 'tx-2', amount: -800, date: '2026-06-05' },
  ],
};

const makeRec = (approvedMonths: Recurrence['approvedMonths']): Recurrence => ({
  id: 'rec-1',
  label: 'Salaire',
  category: 'Revenus',
  expectedAmount: -2000,
  active: true,
  createdAt: Timestamp.now(),
  anchorDate: '2026-06-01',
  approvedMonths,
});

describe('getApprovalEntries', () => {
  it('normalise la forme legacy (une seule tx) en tableau', () => {
    expect(getApprovalEntries(legacyApproval)).toEqual([
      { txId: 'tx-1', amount: -1200, date: '2026-06-02' },
    ]);
  });

  it('retourne les entries quand elles existent', () => {
    expect(getApprovalEntries(multiApproval)).toHaveLength(2);
  });
});

describe('getApprovalAmount', () => {
  it('legacy → montant unique', () => {
    expect(getApprovalAmount(legacyApproval)).toBe(-1200);
  });

  it('multi-tx → somme des montants', () => {
    expect(getApprovalAmount(multiApproval)).toBe(-2000);
  });
});

describe('getApprovedTxIds (multi-tx)', () => {
  it('inclut tous les txId de toutes les entries', () => {
    const ids = getApprovedTxIds([makeRec({ '2026-06': multiApproval })]);
    expect(ids.has('tx-1')).toBe(true);
    expect(ids.has('tx-2')).toBe(true);
  });
});

describe('computePeriodState (multi-tx)', () => {
  it('une approbation multi-tx est payée avec le montant sommé', () => {
    const state = computePeriodState(
      makeRec({ '2026-06': multiApproval }),
      '2026-06',
      [],
      new Date('2026-06-20'),
    );
    expect(state.state).toBe('approved');
    expect(state.effectiveAmount).toBe(-2000);
    expect(state.monthOverride?.linkedAmount).toBe(-2000);
  });
});
