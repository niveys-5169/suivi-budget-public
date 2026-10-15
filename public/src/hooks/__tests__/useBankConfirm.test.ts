import { describe, expect, it } from 'vitest';
import { directlyConfirmable } from '../useBankConfirm';
import type { BankSuggestion } from '../../types/banking.types';

const s = (enableObservationId: string, linxoObservationId: string): BankSuggestion => ({
  enableObservationId,
  linxoObservationId,
});

describe('directlyConfirmable', () => {
  it('garde les suggestions dont les deux observations sont uniques', () => {
    expect(directlyConfirmable([s('e1', 'l1'), s('e2', 'l2')])).toHaveLength(2);
  });

  it('écarte les suggestions ambiguës partageant une observation', () => {
    expect(directlyConfirmable([s('e1', 'l1'), s('e2', 'l1'), s('e3', 'l3')])).toEqual([
      s('e3', 'l3'),
    ]);
  });

  it('écarte les suggestions qui demandent un arbitrage entre deux lignes', () => {
    expect(directlyConfirmable([{ ...s('e1', 'l1'), canonicalRows: [] }])).toEqual([]);
  });
});
