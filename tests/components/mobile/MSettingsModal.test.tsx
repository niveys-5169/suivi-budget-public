import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MSettingsModal } from '../../../public/src/mobile/components/MSettingsModal';

const { getGitHubSettings, saveGitHubSettings, saveAISettingsMock } = vi.hoisted(() => ({
  getGitHubSettings: vi.fn(),
  saveGitHubSettings: vi.fn(),
  saveAISettingsMock: vi.fn(),
}));

vi.mock('../../../public/src/services/firebase-api', () => ({
  getGitHubSettings,
  saveGitHubSettings,
  saveAISettings: (...args: unknown[]) => saveAISettingsMock(...args),
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

/**
 * La config IA n'occupe plus la feuille Paramètres : une ligne ouvre une feuille
 * dédiée. Les requêtes visent cette feuille, pas celle du dessous (qui a son
 * propre bouton « Enregistrer » pour le dépôt GitHub). Re-query à chaque fois :
 * <Sheet> remonte son sous-arbre sous le mock framer-motion.
 */
const openAIConfig = () =>
  fireEvent.click(screen.getByRole('button', { name: /Configuration IA/i }));
const aiSheet = () => within(screen.getByRole('dialog', { name: 'Configuration IA' }));

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

    fireEvent.change(screen.getByLabelText('Propriétaire'), { target: { value: 'new-owner' } });
    fireEvent.change(screen.getByLabelText('Dépôt'), { target: { value: 'new-repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => expect(saveGitHubSettings).toHaveBeenCalledWith('new-owner', 'new-repo'));
  });

  it('enregistre clé, modèle et URL par fournisseur (ancien format migré)', async () => {
    localStorage.setItem('ai_provider', 'openai');
    localStorage.setItem('ai_api_key', 'old-key');
    saveAISettingsMock.mockResolvedValue(undefined);

    render(<MSettingsModal isOpen onClose={onCloseMock} />);
    expect(screen.queryByLabelText('Clé API Gemini')).not.toBeInTheDocument();
    openAIConfig();

    // L'ancienne clé OpenAI a été migrée dans le bloc OpenAI.
    fireEvent.click(aiSheet().getByRole('button', { name: /OpenAI/ }));
    expect(aiSheet().getByLabelText('Clé API OpenAI')).toHaveValue('old-key');

    fireEvent.click(aiSheet().getByRole('button', { name: /NVIDIA/ }));
    fireEvent.change(aiSheet().getByLabelText('Clé API NVIDIA'), { target: { value: 'nv-key' } });
    fireEvent.change(aiSheet().getByLabelText('Modèle'), {
      target: { value: 'meta/llama-3.3-70b-instruct' },
    });
    fireEvent.change(aiSheet().getByLabelText('URL de l’endpoint'), {
      target: { value: 'https://nv.example/v1' },
    });

    fireEvent.click(aiSheet().getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => {
      expect(aiSheet().getByText('Enregistré et synchronisé.')).toBeInTheDocument();
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
    openAIConfig();
    fireEvent.change(aiSheet().getByLabelText('URL de l’endpoint'), {
      target: { value: 'pas une url' },
    });
    fireEvent.click(aiSheet().getByRole('button', { name: /Enregistrer/i }));

    expect(aiSheet().getByText('URL invalide (http(s)://…).')).toBeInTheDocument();
    expect(localStorage.getItem('ai_settings')).toBeNull();
    expect(saveAISettingsMock).not.toHaveBeenCalled();
  });

  it('signale un enregistrement local seulement si la synchro échoue', async () => {
    saveAISettingsMock.mockRejectedValue(new Error('hors ligne'));
    render(<MSettingsModal isOpen onClose={onCloseMock} />);
    openAIConfig();
    fireEvent.change(aiSheet().getByLabelText('Clé API Gemini'), { target: { value: 'g-key' } });
    fireEvent.click(aiSheet().getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => {
      expect(
        aiSheet().getByText('Enregistré sur cet appareil uniquement : hors ligne'),
      ).toBeInTheDocument();
    });
    expect(JSON.parse(localStorage.getItem('ai_settings')!).providers.gemini.apiKey).toBe('g-key');
  });
});
