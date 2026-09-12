import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BudgetProjectionBadge } from '../../../public/src/components/budgets-v2/BudgetProjectionBadge';

vi.mock('../../../public/src/hooks/useBudgetProjection', () => ({
  useBudgetProjection: vi.fn(),
}));

import { useBudgetProjection } from '../../../public/src/hooks/useBudgetProjection';

const mockHook = useBudgetProjection as ReturnType<typeof vi.fn>;

describe('BudgetProjectionBadge', () => {
  it('ne rend rien quand le statut est ok', () => {
    mockHook.mockReturnValue({
      status: 'ok',
      projectedEndAmount: 200,
      limit: 500,
      varianceProjected: -300,
    });

    const { container } = render(
      <BudgetProjectionBadge categoryId="Alimentation" viewMode="monthly" monthKey="2026-05" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('affiche un badge ambre quand le statut est watch', () => {
    mockHook.mockReturnValue({
      status: 'watch',
      projectedEndAmount: 430,
      limit: 500,
      varianceProjected: -70,
    });

    render(
      <BudgetProjectionBadge categoryId="Alimentation" viewMode="monthly" monthKey="2026-05" />,
    );

    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/\b(gold|warning)\b/);
  });

  it('affiche un badge rubis avec le montant de dépassement quand le statut est risk', () => {
    mockHook.mockReturnValue({
      status: 'risk',
      projectedEndAmount: 620,
      limit: 500,
      varianceProjected: 120,
    });

    render(
      <BudgetProjectionBadge categoryId="Alimentation" viewMode="monthly" monthKey="2026-05" />,
    );

    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/\+.*120|120.*€/);
    expect(badge.className).toMatch(/\bnegative\b/);
  });

  it('passe la période correcte au hook pour le mode annuel', () => {
    mockHook.mockReturnValue({
      status: 'ok',
      projectedEndAmount: 0,
      limit: 0,
      varianceProjected: 0,
    });

    render(
      <BudgetProjectionBadge categoryId="Alimentation" viewMode="annual" monthKey="2026-05" />,
    );

    expect(mockHook).toHaveBeenCalledWith('Alimentation', 'year', '2026-05');
  });

  it('passe la période correcte au hook pour le mode mensuel', () => {
    mockHook.mockReturnValue({
      status: 'ok',
      projectedEndAmount: 0,
      limit: 0,
      varianceProjected: 0,
    });

    render(
      <BudgetProjectionBadge categoryId="Alimentation" viewMode="monthly" monthKey="2026-05" />,
    );

    expect(mockHook).toHaveBeenCalledWith('Alimentation', 'month', '2026-05');
  });
});
