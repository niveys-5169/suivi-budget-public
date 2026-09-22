import React, { useId, useState } from 'react';
import { AlertTriangle, ChevronDown, Info, PiggyBank } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Amount, Badge, Card, IconButton, Separator, Stack, Text } from '../../ui';
import type { MonthlySavingsPosition } from '../../types/banking.types';

interface Props {
  position: MonthlySavingsPosition | null;
  loading: boolean;
  error?: Error | null;
}

const MetricRow: React.FC<{
  label: string;
  value: number | null;
  signed?: boolean;
  tone?: 'auto' | 'neutral' | 'positive' | 'negative' | 'warning';
}> = ({ label, value, signed = false, tone = 'auto' }) => (
  <Stack direction="row" gap="sm" align="center" justify="between">
    <Text variant="subhead" tone="secondary">
      {label}
    </Text>
    <Amount value={value} signed={signed} tone={tone} variant="subhead" />
  </Stack>
);

const statusMessageId = (status: MonthlySavingsPosition['status']): string => {
  switch (status) {
    case 'DEFICIT':
      return 'monthlySavings.status.deficit';
    case 'BALANCED':
      return 'monthlySavings.status.balanced';
    case 'FULLY_ALLOCATED':
      return 'monthlySavings.status.fullyAllocated';
    case 'OVER_ALLOCATED':
      return 'monthlySavings.status.overAllocated';
    default:
      return 'monthlySavings.status.available';
  }
};

const SavingsFormulaTooltip: React.FC = () => {
  const { formatMessage: t } = useIntl();
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <IconButton
        label={t({ id: 'monthlySavings.tooltip.label' })}
        size="sm"
        variant="plain"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
      >
        <Info size={16} aria-hidden="true" />
      </IconButton>
      {isOpen ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-full z-sticky mt-2 w-64 rounded-md border border-separator bg-raised p-4 shadow-floating"
        >
          <Stack gap="sm">
            <Text variant="footnote">{t({ id: 'monthlySavings.tooltip.capacity' })}</Text>
            <Text variant="footnote" tone="secondary">
              {t({ id: 'monthlySavings.tooltip.available' })}
            </Text>
            <Text variant="caption" tone="secondary">
              {t({ id: 'monthlySavings.tooltip.transfers' })}
            </Text>
          </Stack>
        </span>
      ) : null}
    </span>
  );
};

export const MonthlySavingsCard: React.FC<Props> = ({ position, loading, error = null }) => {
  const { formatMessage: t } = useIntl();

  if (loading) {
    return (
      <Card bordered aria-busy="true">
        <Stack gap="md">
          <div className="h-4 w-40 animate-pulse rounded-sm bg-raised" />
          <div className="h-10 w-32 animate-pulse rounded-sm bg-raised" />
          <div className="h-4 w-full animate-pulse rounded-sm bg-raised" />
        </Stack>
      </Card>
    );
  }

  if (!position || error || position.dataQuality.calculationStatus === 'UNAVAILABLE') {
    const missing = [
      ...(position?.dataQuality.missingOpeningBalances || []),
      ...(position?.dataQuality.missingClosingBalances || []),
    ];
    return (
      <Card bordered>
        <Stack gap="md">
          <Stack direction="row" gap="sm" align="center">
            <AlertTriangle size={20} className="text-warning" aria-hidden="true" />
            <Text variant="headline">{t({ id: 'monthlySavings.unavailable.title' })}</Text>
          </Stack>
          <Text variant="subhead" tone="secondary">
            {error
              ? t({ id: 'monthlySavings.unavailable.load' })
              : t({ id: 'monthlySavings.unavailable.missing' })}
          </Text>
          {missing.length > 0 ? (
            <Text variant="footnote" tone="warning">
              {missing.join(', ')}
            </Text>
          ) : null}
        </Stack>
      </Card>
    );
  }

  const quality = position.dataQuality.calculationStatus;
  const allocationLabel =
    position.status === 'OVER_ALLOCATED'
      ? t({ id: 'monthlySavings.metric.overAllocated' })
      : position.status === 'DEFICIT' && position.netSavings < 0
        ? t({ id: 'monthlySavings.metric.netWithdrawal' })
        : position.status === 'AVAILABLE_TO_SAVE'
          ? t({ id: 'monthlySavings.metric.available' })
          : t({ id: 'monthlySavings.metric.remaining' });
  const allocationValue =
    position.status === 'OVER_ALLOCATED'
      ? Math.abs(position.unallocatedSurplus || 0)
      : position.status === 'DEFICIT' && position.netSavings < 0
        ? Math.abs(position.netSavings)
        : position.unallocatedSurplus;

  return (
    <Card bordered data-testid="monthly-savings-card">
      <Stack gap="lg">
        <Stack direction="row" gap="sm" align="center" justify="between" wrap>
          <Stack direction="row" gap="sm" align="center">
            <PiggyBank size={20} className="text-gold" aria-hidden="true" />
            <Text variant="overline" tone="secondary">
              {position.isCompleteMonth
                ? t({ id: 'monthlySavings.title.complete' })
                : t({ id: 'monthlySavings.title.current' })}
            </Text>
            <SavingsFormulaTooltip />
          </Stack>
          {!position.isCompleteMonth ? (
            <Badge tone="neutral" dot>
              {t({ id: 'monthlySavings.provisional' })}
            </Badge>
          ) : null}
        </Stack>

        <Stack gap="sm">
          <Amount value={position.savingsCapacity} signed variant="display" />
          <Text variant="callout" tone="secondary">
            {t({ id: statusMessageId(position.status) })}
          </Text>
        </Stack>

        <Separator />

        <Stack gap="md">
          <MetricRow
            label={t({ id: 'monthlySavings.metric.netSavings' })}
            value={position.netSavings}
            signed
          />
          <MetricRow
            label={allocationLabel}
            value={allocationValue}
            signed={position.status === 'AVAILABLE_TO_SAVE'}
            tone={position.status === 'OVER_ALLOCATED' ? 'warning' : 'auto'}
          />
        </Stack>

        {quality === 'PARTIAL' ? (
          <Stack
            direction="row"
            gap="sm"
            align="start"
            className="rounded-md bg-warning-subtle p-2"
          >
            <AlertTriangle size={16} className="shrink-0 text-warning" aria-hidden="true" />
            <Text variant="footnote" tone="warning">
              {t({ id: 'monthlySavings.quality.partial' })}
            </Text>
          </Stack>
        ) : null}

        <details>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 text-subhead font-semibold text-label-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            {t({ id: 'monthlySavings.details.title' })}
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <Stack gap="md" className="px-2 pb-2 pt-4">
            <MetricRow
              label={t({ id: 'monthlySavings.details.opening' })}
              value={position.openingOperatingBalance}
              tone="neutral"
            />
            <MetricRow
              label={t({ id: 'monthlySavings.details.closing' })}
              value={position.closingOperatingBalance}
              tone="neutral"
            />
            <MetricRow
              label={t({ id: 'monthlySavings.details.delta' })}
              value={position.operatingBalanceDelta}
              signed
            />
            <Separator />
            <MetricRow
              label={t({ id: 'monthlySavings.details.deposits' })}
              value={position.savingsDeposits}
              signed
            />
            <MetricRow
              label={t({ id: 'monthlySavings.details.withdrawals' })}
              value={position.savingsWithdrawals === 0 ? 0 : -position.savingsWithdrawals}
            />
            <MetricRow
              label={t({ id: 'monthlySavings.metric.netSavings' })}
              value={position.netSavings}
              signed
            />
            <Separator />
            <MetricRow
              label={t({ id: 'monthlySavings.details.transactionCapacity' })}
              value={position.capacityFromTransactions}
              signed
            />
            <MetricRow
              label={t({ id: 'monthlySavings.details.reconciliation' })}
              value={position.dataQuality.reconciliationDelta}
              signed
              tone={
                Math.abs(position.dataQuality.reconciliationDelta || 0) > 0.01
                  ? 'warning'
                  : 'neutral'
              }
            />
          </Stack>
        </details>
      </Stack>
    </Card>
  );
};
