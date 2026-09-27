import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MSettingsModal } from '../../../public/src/mobile/components/MSettingsModal';

const { getGitHubSettings, saveGitHubSettings, saveAISettings } = vi.hoisted(() => ({
  getGitHubSettings: vi.fn(),
  saveGitHubSettings: vi.fn(),
  saveAISettings: vi.fn(),
}));

vi.mock('../../../public/src/services/firebase-api', () => ({
  getGitHubSettings,
  saveGitHubSettings,
  saveAISettings,
}));

vi.mock('../../../public/src/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

vi.mock('../../../public/src/hooks/usePWAUpdate', () => ({
  usePWAUpdate: () => ({ isRefreshing: false, refreshApp: vi.fn() }),
}));

vi.mock('../../../public/src/hooks/usePreferences', () => ({
  usePreferences: () => ({ density: 'normal', setDensity: vi.fn() }),
}));

vi.mock('../../../public/src/hooks/useSyncTransactions', () => ({
  useSyncTransactions: () => ({ sync: vi.fn(), isSyncing: false }),
}));

describe('MSettingsModal', () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getGitHubSettings.mockResolvedValue({ owner: 'old-owner', repo: 'old-repo' });
    saveGitHubSettings.mockResolvedValue(undefined);
  });

  it('charge et enregistre le dépôt GitHub dans Firestore', async () => {
    render(<MSettingsModal isOpen onClose={onCloseMock} />);

    expect(screen.getByText('Source des données')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Propriétaire')).toHaveValue('old-owner'));
    expect(screen.getByLabelText('Dépôt')).toHaveValue('old-repo');

    // Re-query each input: <Sheet> remounts its subtree between renders under
    // the framer-motion test mock, so cached element refs go stale.
    fireEvent.change(screen.getByLabelText('Propriétaire'), { target: { value: 'new-owner' } });
    fireEvent.change(screen.getByLabelText('Dépôt'), { target: { value: 'new-repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => expect(saveGitHubSettings).toHaveBeenCalledWith('new-owner', 'new-repo'));
  });

  it("ouvre la configuration IA dans une feuille dédiée et l'enregistre", async () => {
    localStorage.setItem('ai_provider', 'openai');
    localStorage.setItem('ai_api_key', 'old-key');

    render(<MSettingsModal isOpen onClose={onCloseMock} />);

    // La config IA n'occupe plus la feuille : une seule ligne, qui ouvre la feuille dédiée.
    expect(screen.queryByLabelText('Clé API')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Configuration IA/i }));

    await waitFor(() => expect(screen.getByLabelText('Clé API')).toHaveValue('old-key'));

    fireEvent.change(screen.getByLabelText('Clé API'), { target: { value: 'new-key' } });
    fireEvent.change(screen.getByLabelText('URL de base'), {
      target: { value: 'https://new-base-url' },
    });
    fireEvent.change(screen.getByLabelText('Fournisseur'), { target: { value: 'gemini' } });

    // Le bouton de la feuille IA, pas celui du dépôt GitHub resté dessous.
    const aiDialog = screen.getByRole('dialog', { name: 'Configuration IA' });
    fireEvent.click(within(aiDialog).getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => {
      expect(localStorage.getItem('ai_provider')).toBe('gemini');
      expect(localStorage.getItem('ai_api_key')).toBe('new-key');
      // Modèle vide → valeur par défaut du fournisseur.
      expect(localStorage.getItem('ai_model')).toBe('gemini-2.0-flash-exp');
      expect(localStorage.getItem('ai_base_url')).toBe('https://new-base-url');
    });
    expect(saveAISettings).toHaveBeenCalledWith(
      'gemini',
      'new-key',
      'gemini-2.0-flash-exp',
      'https://new-base-url',
    );
  });
});
