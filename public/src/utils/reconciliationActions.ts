type BaseReconciliationPayload = {
  accountId: string;
  isSavings?: boolean;
};

export const buildConfirmReconciliationPayload = ({
  accountId,
  isSavings = false,
}: BaseReconciliationPayload) => ({
  accountId,
  isSavings,
  eventType: 'reconciled_manual_confirm',
});

export const buildManualOverridePayload = ({
  accountId,
  isSavings = false,
  value,
}: BaseReconciliationPayload & { value: number }) => ({
  accountId,
  isSavings,
  eventType: 'reconciled_manual_override',
  manualValue: value,
});

export const buildSourceChoicePayload = ({
  accountId,
  isSavings = false,
  discrepancyId,
  source,
  value,
}: BaseReconciliationPayload & {
  discrepancyId?: string;
  source: string;
  value: number;
}) => ({
  accountId,
  isSavings,
  eventType: 'reconciled_user_choice',
  discrepancyId,
  chosenSource: source,
  chosenValue: value,
});
