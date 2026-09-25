import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MSettingsModal } from '../../../public/src/mobile/components/MSettingsModal';

// Mock dependencies
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

const saveAISettingsMock = vi.fn();
vi.mock('../../../public/src/services/firebase-api', () => ({
  saveAISettings: (...args: unknown[]) => saveAISettingsMock(...args),
}));

describe('MSettingsModal', () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders and saves GitHub repo configuration', async () => {
    // Initial setup in localStorage
    localStorage.setItem('github_owner', 'old-owner');
    localStorage.setItem('github_repo', 'old-repo');

    render(<MSettingsModal isOpen onClose={onCloseMock} />);

    // Check if the section "Source des données" exists
    expect(screen.getByText('Source des données')).toBeInTheDocument();

    // Initial values
    expect(screen.getByLabelText('Propriétaire')).toHaveValue('old-owner');
    expect(screen.getByLabelText('Dépôt')).toHaveValue('old-repo');

    // Type new values. Re-query each input: <Sheet> remounts its subtree
    // between renders under the framer-motion test mock, so cached element refs go stale.
    fireEvent.change(screen.getByLabelText('Propriétaire'), {
      target: { value: 'new-owner' },
    });
    fireEvent.change(screen.getByLabelText('Dépôt'), {
      target: { value: 'new-repo' },
    });

    // Click "Enregistrer" inside this section (Source des données = 2nd save button)
    fireEvent.click(screen.getAllByRole('button', { name: /Enregistrer/i })[1]!);

    // Verify localStorage was updated
    await waitFor(() => {
      expect(localStorage.getItem('github_owner')).toBe('new-owner');
      expect(localStorage.getItem('github_repo')).toBe('new-repo');
      expect(screen.getAllByText('Enregistré')[0]).toBeInTheDocument();
    });
  });

  it('enregistre clé, modèle et URL par fournisseur (ancien format migré)', async () => {
    localStorage.setItem('ai_provider', 'openai');
    localStorage.setItem('ai_api_key', 'old-key');
    saveAISettingsMock.mockResolvedValue(undefined);

    render(<MSettingsModal isOpen onClose={onCloseMock} />);
    expect(screen.getByText('Assistant IA')).toBeInTheDocument();

    // L'ancienne clé OpenAI a été migrée dans le bloc OpenAI.
    fireEvent.click(screen.getByRole('button', { name: /OpenAI/ }));
    expect(screen.getByLabelText('Clé API OpenAI')).toHaveValue('old-key');

    // Re-query each field: <Sheet> remounts its subtree under the framer-motion mock.
    fireEvent.click(screen.getByRole('button', { name: /NVIDIA/ }));
    fireEvent.change(screen.getByLabelText('Clé API NVIDIA'), { target: { value: 'nv-key' } });
    fireEvent.change(screen.getByLabelText('Modèle'), {
      target: { value: 'meta/llama-3.3-70b-instruct' },
    });
    fireEvent.change(screen.getByLabelText('URL de l’endpoint'), {
      target: { value: 'https://nv.example/v1' },
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Enregistrer/i })[0]!);

    await waitFor(() => {
      expect(screen.getByText('Enregistré et synchronisé.')).toBeInTheDocument();
    });
    const stored = JSON.parse(localStorage.getItem('ai_settings')!);
    expect(stored.providers.openai.apiKey).toBe('old-key');
    expect(stored.providers.nvidia).toEqual({
      apiKey: 'nv-key',
      model: 'meta/llama-3.3-70b-instruct',
      baseUrl: 'https://nv.example/v1',
    });
    expect(localStorage.getItem('ai_api_key')).toBeNull();
    expect(saveAISettingsMock).toHaveBeenCalledWith(stored);
  });

  it('refuse une URL d’endpoint invalide', () => {
    render(<MSettingsModal isOpen onClose={onCloseMock} />);
    fireEvent.change(screen.getByLabelText('URL de l’endpoint'), {
      target: { value: 'pas une url' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Enregistrer/i })[0]!);

    expect(screen.getByText('URL invalide (http(s)://…).')).toBeInTheDocument();
    expect(localStorage.getItem('ai_settings')).toBeNull();
    expect(saveAISettingsMock).not.toHaveBeenCalled();
  });

  it('signale un enregistrement local seulement si la synchro échoue', async () => {
    saveAISettingsMock.mockRejectedValue(new Error('hors ligne'));
    render(<MSettingsModal isOpen onClose={onCloseMock} />);
    fireEvent.change(screen.getByLabelText('Clé API Gemini'), { target: { value: 'g-key' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Enregistrer/i })[0]!);

    await waitFor(() => {
      expect(
        screen.getByText('Enregistré sur cet appareil uniquement : hors ligne'),
      ).toBeInTheDocument();
    });
    expect(JSON.parse(localStorage.getItem('ai_settings')!).providers.gemini.apiKey).toBe('g-key');
  });
});
