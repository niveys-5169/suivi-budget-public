import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { SettingsPage } from '../SettingsPage';

vi.mock('../../../services/firebase', () => ({ functions: {}, db: {} }));
vi.mock('../../../services/firebase-api', () => ({
  getGitHubSettings: vi.fn().mockResolvedValue(null),
  saveGitHubSettings: vi.fn(),
  saveAISettings: vi.fn(),
}));
vi.mock('../../../hooks/usePreferences', () => ({
  usePreferences: () => ({
    density: 'comfortable',
    setDensity: vi.fn(),
    theme: 'dark',
    setTheme: vi.fn(),
  }),
}));
vi.mock('../../../hooks/usePWAUpdate', () => ({
  usePWAUpdate: () => ({ isRefreshing: false, refreshApp: vi.fn() }),
}));
vi.mock('../../../hooks/useAdvancedSettings', () => ({
  useAdvancedSettings: () => ({ ownerMapping: null, updateOwnerMapping: vi.fn() }),
}));
vi.mock('../../../hooks/useWeeklyReportSettings', () => ({
  useWeeklyReportSettings: () => ({
    config: { enabled: true, recipients: [] },
    loading: false,
    isSending: false,
    updateConfig: vi.fn(),
    sendNow: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useBalances', () => ({ useBalances: () => ({ balances: [] }) }));
vi.mock('../../CategoryIconEditor', () => ({ CategoryIconEditor: () => null }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <SettingsPage />
    </MemoryRouter>,
  );

describe('SettingsPage', () => {
  it('ouvre la section Général par défaut', () => {
    renderAt('/settings');
    expect(screen.getByText('Affichage')).toBeInTheDocument();
    expect(screen.queryByLabelText('Clé API Gemini')).not.toBeInTheDocument();
  });

  it('ouvre directement la section demandée par ?section=', () => {
    renderAt('/settings?section=ia');
    expect(screen.getByLabelText('Clé API Gemini')).toBeInTheDocument();
  });

  it('bascule de section via les puces', () => {
    renderAt('/settings');
    fireEvent.click(screen.getByRole('button', { name: 'Import des données' }));
    expect(screen.getByText('Dépôt GitHub')).toBeInTheDocument();
    expect(screen.getByText('Tronity')).toBeInTheDocument();
    expect(screen.queryByText('Affichage')).not.toBeInTheDocument();
  });
});
