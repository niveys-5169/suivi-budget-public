import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import { WealthPage } from '../../public/src/components/WealthPage';
import { useWealthScope } from '../../public/src/hooks/useWealthScope';
import { useWealthAggregates } from '../../public/src/hooks/useWealthAggregates';
import { usePatrimoine } from '../../public/src/hooks/usePatrimoine';
import { usePortfolio } from '../../public/src/hooks/usePortfolio';

expect.extend(toHaveNoViolations);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('../../public/src/hooks/useWealthScope', () => ({ useWealthScope: vi.fn() }));
vi.mock('../../public/src/hooks/useWealthAggregates', () => ({ useWealthAggregates: vi.fn() }));
vi.mock('../../public/src/hooks/usePatrimoine', () => ({ usePatrimoine: vi.fn() }));
vi.mock('../../public/src/hooks/usePortfolio', () => ({ usePortfolio: vi.fn() }));
vi.mock('../../public/src/hooks/usePlacements', () => ({ getLastPlacementSnapshot: vi.fn() }));

// Heavy children — mock to keep the axe run focussed on the page shell.
vi.mock('../../public/src/components/WealthTotalCard', () => ({
  WealthTotalCard: () => <div data-testid="wealth-total" />,
}));
vi.mock('../../public/src/components/WealthEvolutionBudgetChart', () => ({
  WealthEvolutionBudgetChart: () => <div data-testid="wealth-chart" />,
}));
vi.mock('../../public/src/components/WealthAccountsList', () => ({
  WealthAccountsList: () => <div data-testid="wealth-accounts" />,
}));
vi.mock('../../public/src/components/WealthAllocationBars', () => ({
  WealthAllocationBars: () => <div data-testid="wealth-allocation" />,
}));
vi.mock('../../public/src/components/WealthPortfolioTable', () => ({
  WealthPortfolioTable: () => <div data-testid="wealth-portfolio" />,
}));
vi.mock('../../public/src/components/PlacementDetailModal', () => ({
  PlacementDetailModal: () => null,
}));
vi.mock('../../public/src/components/PlacementFormModal', () => ({
  PlacementFormModal: () => null,
}));
vi.mock('../../public/src/components/dashboard/v2/PlacementSnapshotModal', () => ({
  PlacementSnapshotModal: () => null,
}));
vi.mock('../../public/src/components/dashboard/v2/HistoryManagementModal', () => ({
  HistoryManagementModal: () => null,
}));
vi.mock('../../public/src/components/OwnerScopeToggle', () => ({
  OwnerScopeToggle: () => <div data-testid="owner-scope" />,
}));

describe('WealthPage — accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWealthScope as any).mockReturnValue({
      ownerScope: 'all',
      setOwnerScope: vi.fn(),
      wealthTypeScope: 'all',
      setWealthTypeScope: vi.fn(),
    });
    (useWealthAggregates as any).mockReturnValue({
      total: 100000,
      per: {},
      segments: [],
      filteredAssets: [],
      delta30dValue: 0,
      delta30dPct: 0,
    });
    (usePatrimoine as any).mockReturnValue({
      loading: false,
      ownerMapping: {},
      placementHistory: [],
      placements: [],
      savingsBalances: [],
    });
    (usePortfolio as any).mockReturnValue({
      holdings: [],
      totalValue: 0,
      loading: false,
      backfilling: false,
      backfillHistory: vi.fn(),
      refreshPortfolio: vi.fn(),
      backfillResult: null,
    });
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <WealthPage />
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 30_000);
});
