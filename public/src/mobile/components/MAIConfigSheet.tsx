import React, { useState } from 'react';
import { Modal } from '../../components/shared/Modal';
import { PROVIDER_DEFAULTS } from '../constants/aiProviders';
import { saveAISettings } from '../../services/firebase-api';

interface Props {
  onClose: () => void;
}

export function MAIConfigSheet({ onClose }: Props) {
  const [provider, setProvider] = useState(localStorage.getItem('ai_provider') || 'gemini');
  const [apiKey, setApiKey] = useState(localStorage.getItem('ai_api_key') || '');
  const [model, setModel] = useState(localStorage.getItem('ai_model') || '');
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('ai_base_url') || '');

  const modelPlaceholder = PROVIDER_DEFAULTS[provider] || '';

  const handleSave = () => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('ai_api_key', apiKey);
    localStorage.setItem('ai_model', model.trim() || modelPlaceholder);
    localStorage.setItem('ai_base_url', baseUrl);
    saveAISettings(provider, apiKey, model.trim() || modelPlaceholder, baseUrl);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Configuration IA"
      variant="sheet"
      size="sm"
      fullHeight={false}
    >
      <div className="px-6 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] space-y-4">
        <label className="block">
          <span className="block text-footnote text-label-secondary mb-1">Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-black/20 border border-separator rounded-xl px-4 py-4 text-white text-base focus:outline-none focus:border-gold/50 transition-colors appearance-none"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
            <option value="nvidia">Nvidia</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-footnote text-label-secondary mb-1">Clé API</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-black/20 border border-separator rounded-xl px-4 py-4 text-white text-base focus:outline-none focus:border-gold/50 transition-colors"
          />
        </label>
        <label className="block">
          <span className="block text-footnote text-label-secondary mb-1">Modèle (optionnel)</span>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={modelPlaceholder}
            className="w-full bg-black/20 border border-separator rounded-xl px-4 py-4 text-white text-base focus:outline-none focus:border-gold/50 transition-colors"
          />
        </label>
        <label className="block">
          <span className="block text-footnote text-label-secondary mb-1">
            URL base (optionnel)
          </span>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full bg-black/20 border border-separator rounded-xl px-4 py-4 text-white text-base focus:outline-none focus:border-gold/50 transition-colors"
          />
        </label>
        <button
          onClick={handleSave}
          className="w-full bg-gold text-bg font-bold p-4 rounded-xl mt-4"
        >
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
