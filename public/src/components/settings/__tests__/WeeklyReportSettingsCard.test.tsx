import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WeeklyReportSettingsCard } from '../WeeklyReportSettingsCard';

const mockUpdateConfig = vi.fn();
const mockSendNow = vi.fn();

vi.mock('../../../hooks/useWeeklyReportSettings', () => ({
  useWeeklyReportSettings: () => ({
    config: {
      enabled: true,
      recipients: ['test@example.com'],
      lastSentAt: '2026-10-21T18:00:00Z',
      lastStatus: 'success',
      lastRecipients: ['test@example.com'],
    },
    loading: false,
    isSending: false,
    updateConfig: mockUpdateConfig,
    sendNow: mockSendNow,
  }),
}));

describe('WeeklyReportSettingsCard', () => {
  it('affiche le titre et les éléments de configuration', () => {
    render(<WeeklyReportSettingsCard />);
    expect(screen.getByText('Email récapitulatif hebdomadaire')).toBeInTheDocument();
    expect(screen.getByText(/Chaque vendredi à 18h00/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer maintenant' })).toBeInTheDocument();
  });

  it('appelle sendNow au clic sur le bouton', () => {
    render(<WeeklyReportSettingsCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer maintenant' }));
    expect(mockSendNow).toHaveBeenCalledTimes(1);
  });

  it('appelle updateConfig lors du basculement du switch', () => {
    render(<WeeklyReportSettingsCard />);
    const switchBtn = screen.getByRole('switch', { name: "Activer l'envoi hebdomadaire" });
    fireEvent.click(switchBtn);
    expect(mockUpdateConfig).toHaveBeenCalledWith({ enabled: false });
  });
});
