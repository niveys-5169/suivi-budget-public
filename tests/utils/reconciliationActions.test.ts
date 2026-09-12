import { describe, expect, it } from 'vitest';
import {
  buildConfirmReconciliationPayload,
  buildManualOverridePayload,
  buildSourceChoicePayload,
} from '../../public/src/utils/reconciliationActions';

describe('reconciliation action payloads', () => {
  it('builds a confirm payload that keeps the current balance', () => {
    expect(buildConfirmReconciliationPayload({ accountId: 'acc-1', isSavings: false })).toEqual({
      accountId: 'acc-1',
      isSavings: false,
      eventType: 'reconciled_manual_confirm',
    });
  });

  it('builds a manual override payload with a numeric balance', () => {
    expect(
      buildManualOverridePayload({ accountId: 'acc-1', isSavings: true, value: 123.45 }),
    ).toEqual({
      accountId: 'acc-1',
      isSavings: true,
      eventType: 'reconciled_manual_override',
      manualValue: 123.45,
    });
  });

  it('builds a source choice payload for resolving an identified discrepancy', () => {
    expect(
      buildSourceChoicePayload({
        accountId: 'acc-1',
        isSavings: false,
        discrepancyId: 'gap-1',
        source: 'parsed_balance',
        value: 980,
      }),
    ).toEqual({
      accountId: 'acc-1',
      isSavings: false,
      eventType: 'reconciled_user_choice',
      discrepancyId: 'gap-1',
      chosenSource: 'parsed_balance',
      chosenValue: 980,
    });
  });
});
