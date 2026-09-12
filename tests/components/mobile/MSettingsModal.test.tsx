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

  it('renders and saves AI configuration', async () => {
    localStorage.setItem('ai_provider', 'openai');
    localStorage.setItem('ai_api_key', 'old-key');

    render(<MSettingsModal isOpen onClose={onCloseMock} />);

    expect(screen.getByText('Assistant IA')).toBeInTheDocument();

    expect(screen.getByLabelText('Clé API')).toHaveValue('old-key');

    // Re-query each field (<Sheet> remounts its subtree between renders under
    // the framer-motion test mock). Change the provider last so the model placeholder
    // stays 'gpt-4o-mini' while we target it.
    fireEvent.change(screen.getByLabelText('Clé API'), { target: { value: 'new-key' } });
    fireEvent.change(screen.getByLabelText('Modèle'), {
      target: { value: 'gemini-2.0-flash-exp' },
    });
    fireEvent.change(screen.getByLabelText('URL de base'), {
      target: { value: 'https://new-base-url' },
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'gemini' } });

    // Assistant IA = 1st save button
    fireEvent.click(screen.getAllByRole('button', { name: /Enregistrer/i })[0]!);

    await waitFor(() => {
      expect(localStorage.getItem('ai_provider')).toBe('gemini');
      expect(localStorage.getItem('ai_api_key')).toBe('new-key');
      expect(localStorage.getItem('ai_model')).toBe('gemini-2.0-flash-exp');
      expect(localStorage.getItem('ai_base_url')).toBe('https://new-base-url');
      expect(screen.getAllByText('Enregistré')[0]).toBeInTheDocument();
    });
  });
});
