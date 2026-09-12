import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AurumCashflowCard } from '../../../../public/src/components/dashboard/v2/AurumCashflowCard';
import { useCashflowForecast } from '../../../../public/src/hooks/useCashflowForecast';

// Mock matchMedia
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

// Mock formatCurrency
vi.mock('../../../../public/src/lib/formatters', () => ({
  formatCurrency: (val: number) => `${val} €`,
}));

// Mock the hook
vi.mock('../../../../public/src/hooks/useCashflowForecast', () => ({
  useCashflowForecast: vi.fn(),
}));

describe('AurumCashflowCard Component', () => {
  const mockUseCashflowForecast = vi.mocked(useCashflowForecast);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropdown and filters events up to the lowest point', () => {
    // Mock return value for useCashflowForecast
    mockUseCashflowForecast.mockReturnValue({
      days: [
        {
          date: '2026-06-12',
          balance: 4500,
          events: [],
        },
        {
          date: '2026-06-15',
          balance: 3900,
          events: [
            {
              date: '2026-06-15',
              label: 'Dépense Importante',
              amount: -600,
              type: 'expense',
              sourceKey: 'exp-1',
            },
          ],
        },
        {
          date: '2026-06-20',
          balance: 5100,
          events: [
            {
              date: '2026-06-20',
              label: 'Revenu Après Point Bas',
              amount: 1200,
              type: 'income',
              sourceKey: 'inc-1',
            },
            {
              date: '2026-06-22',
              label: 'Dépense Après Point Bas',
              amount: -100,
              type: 'expense',
              sourceKey: 'exp-2',
            },
          ],
        },
      ],
      lowestPoint: { date: '2026-06-15', balance: 3900 },
      breachDate: null,
      belowZeroDate: null,
      upcomingEvents: [],
    });

    render(<AurumCashflowCard />);

    // 1. Check if dropdown is present with default 30
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('30');

    // 2. Check if the events leading to the lowest point are rendered
    expect(screen.getByText('Dépense Importante')).toBeInTheDocument();
    expect(screen.getByText('-600 €')).toBeInTheDocument();

    // 3. Check that incomes after lowest point are rendered, but expenses after lowest point are NOT
    expect(screen.getByText('Revenu Après Point Bas')).toBeInTheDocument();
    expect(screen.queryByText('Dépense Après Point Bas')).not.toBeInTheDocument();

    // 4. Change select to 60 and verify hook call
    fireEvent.change(select, { target: { value: '60' } });
    expect(mockUseCashflowForecast).toHaveBeenLastCalledWith(60, 0);
  });
});
