import { useCallback, useState } from 'react';
import {
  AI_FALLBACK_ORDER,
  isValidBaseUrl,
  readAISettings,
  writeAISettings,
  type AIProvider,
  type AISettings,
  type ProviderSettings,
} from '../utils/aiConfig';
import { saveAISettings } from '../services/firebase-api';

export type AISaveStatus = 'idle' | 'saving' | 'saved' | 'local-only' | 'invalid';

/** Brouillon des réglages IA (tous fournisseurs) + validation et enregistrement. */
export function useAISettingsForm() {
  const [settings, setSettings] = useState<AISettings>(readAISettings);
  const [provider, setProvider] = useState<AIProvider>(AI_FALLBACK_ORDER[0]!);
  const [status, setStatus] = useState<AISaveStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const updateProvider = useCallback(
    (target: AIProvider, field: keyof ProviderSettings, value: string) => {
      setSettings((prev) => ({
        ...prev,
        providers: { ...prev.providers, [target]: { ...prev.providers[target], [field]: value } },
      }));
      setStatus('idle');
    },
    [],
  );

  const setSearchApiKey = useCallback((value: string) => {
    setSettings((prev) => ({ ...prev, searchApiKey: value }));
    setStatus('idle');
  }, []);

  /** Fournisseurs dont l'URL de base saisie est invalide. */
  const invalidUrls = AI_FALLBACK_ORDER.filter(
    (p) => !isValidBaseUrl(settings.providers[p].baseUrl),
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (AI_FALLBACK_ORDER.some((p) => !isValidBaseUrl(settings.providers[p].baseUrl))) {
      setStatus('invalid');
      return false;
    }
    setStatus('saving');
    writeAISettings(settings);
    try {
      await saveAISettings(settings);
      setSyncError(null);
      setStatus('saved');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Synchronisation impossible.');
      setStatus('local-only');
    }
    return true;
  }, [settings]);

  return {
    settings,
    provider,
    setProvider,
    updateProvider,
    setSearchApiKey,
    invalidUrls,
    save,
    status,
    syncError,
  };
}
