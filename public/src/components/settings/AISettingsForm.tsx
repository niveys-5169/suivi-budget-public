import React, { useState } from 'react';
import { PROVIDER_DEFAULTS } from '../../mobile/constants/aiProviders';
import { saveAISettings } from '../../services/firebase-api';
import { toast } from '../../lib/toast';
import { Button, Field, Input, Select, Stack } from '../../ui';

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'nvidia', label: 'NVIDIA Build' },
];

/**
 * Formulaire unique de configuration de l'assistant IA — partagé par la page
 * Paramètres, la modale de l'assistant desktop et les feuilles mobiles.
 *
 * Pas de rechargement après enregistrement : `readAIConfig()` relit le
 * localStorage à chaque question.
 */
export const AISettingsForm: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
  const [provider, setProvider] = useState(localStorage.getItem('ai_provider') || 'gemini');
  const [apiKey, setApiKey] = useState(localStorage.getItem('ai_api_key') || '');
  const [model, setModel] = useState(localStorage.getItem('ai_model') || '');
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('ai_base_url') || '');

  const defaultModel = PROVIDER_DEFAULTS[provider] || '';

  const handleSave = () => {
    const finalModel = model.trim() || defaultModel;
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('ai_api_key', apiKey);
    localStorage.setItem('ai_model', finalModel);
    localStorage.setItem('ai_base_url', baseUrl);
    saveAISettings(provider, apiKey, finalModel, baseUrl);
    toast.success('Configuration IA enregistrée');
    onSaved?.();
  };

  return (
    <Stack gap="md">
      <Field label="Fournisseur">
        {(p) => (
          <Select {...p} value={provider} onChange={(e) => setProvider(e.target.value)}>
            {PROVIDERS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Clé API">
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        )}
      </Field>
      <Field label="Modèle" hint={`Par défaut : ${defaultModel}`}>
        {(p) => (
          <Input
            {...p}
            value={model}
            placeholder={defaultModel}
            autoComplete="off"
            onChange={(e) => setModel(e.target.value)}
          />
        )}
      </Field>
      <Field label="URL de base" hint="Optionnelle.">
        {(p) => (
          <Input
            {...p}
            value={baseUrl}
            inputMode="url"
            autoComplete="off"
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        )}
      </Field>
      <Button variant="primary" block onClick={handleSave}>
        Enregistrer
      </Button>
    </Stack>
  );
};
