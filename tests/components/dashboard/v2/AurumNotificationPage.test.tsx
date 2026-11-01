import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AurumNotificationPage } from '../../../../public/src/components/dashboard/v2/AurumNotificationPage';

const alerts = vi.hoisted(() => ({ current: [] as unknown[], loading: false }));

vi.mock('../../../../public/src/hooks/useAlerts', () => ({
  useAlerts: () => ({ alerts: alerts.current, loading: alerts.loading, markAllRead: vi.fn() }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <AurumNotificationPage onBack={vi.fn()} />
    </MemoryRouter>,
  );

describe('AurumNotificationPage', () => {
  it('sans alerte, dit pourquoi la page est vide', () => {
    alerts.current = [];
    alerts.loading = false;
    renderPage();

    expect(screen.getByText('Aucune alerte')).toBeInTheDocument();
    expect(screen.getByText(/Budgets respectés, récurrences à jour/)).toBeInTheDocument();
  });

  it('n’affiche pas l’état vide tant que les données chargent', () => {
    alerts.current = [];
    alerts.loading = true;
    renderPage();

    expect(screen.queryByText('Aucune alerte')).toBeNull();
  });

  it('avec des alertes, n’affiche pas l’état vide', () => {
    alerts.loading = false;
    alerts.current = [
      { id: 'a1', type: 'warning', title: 'Budget dépassé', desc: 'Courses', time: 'Aujourd’hui' },
    ];
    renderPage();

    expect(screen.getByText('Budget dépassé')).toBeInTheDocument();
    expect(screen.queryByText('Aucune alerte')).toBeNull();
  });
});
