import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';
import { Button } from '../shared/Button';
import type { AIProvider } from '../../hooks/useFinanceQA';
import { saveAISettings } from '../../services/firebase-api';

interface AISettingsFormProps {
  onSave?: () => void;
  showTitle?: boolean;
}

export const AISettingsForm: React.FC<AISettingsFormProps> = ({ onSave, showTitle = true }) => {
  const [apiKeys, setApiKeys] = useState({
    gemini: localStorage.getItem('ai_api_key') || '',
    provider: (localStorage.getItem('ai_provider') as AIProvider) || 'gemini',
    model: localStorage.getItem('ai_model') || '',
    baseUrl: localStorage.getItem('ai_base_url') || '',
  });

  const saveApiKeys = () => {
    localStorage.setItem('ai_api_key', apiKeys.gemini);
    localStorage.setItem('ai_provider', apiKeys.provider);
    localStorage.setItem('ai_model', apiKeys.model);
    localStorage.setItem('ai_base_url', apiKeys.baseUrl);
    saveAISettings(apiKeys.provider, apiKeys.gemini, apiKeys.model, apiKeys.baseUrl);

    if (onSave) {
      onSave();
    } else {
      window.location.reload(); // Default behavior: refresh to apply
    }
  };

  const providers: { id: AIProvider; label: string }[] = [
    { id: 'gemini', label: 'Google Gemini' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'openrouter', label: 'OpenRouter' },
    { id: 'nvidia', label: 'NVIDIA Build' },
  ];

  const getHint = () => {
    if (apiKeys.provider === 'gemini') {
      return (
        <span>
          Clé gratuite via <strong>Google AI Studio</strong> (aistudio.google.com).
          <br />
          Modèles : gemini-2.0-flash, gemini-1.5-flash.
        </span>
      );
    }
    if (apiKeys.provider === 'openai') {
      return (
        <span>
          Clé sur <strong>platform.openai.com</strong>.
          <br />
          Modèle par défaut : <strong>gpt-4o-mini</strong>.
        </span>
      );
    }
    if (apiKeys.provider === 'openrouter') {
      return (
        <span>
          Clé sur <strong>openrouter.ai</strong>.
          <br />
          Accès à Claude, GPT-4, Llama, Gemini via une seule API.
        </span>
      );
    }
    if (apiKeys.provider === 'nvidia') {
      return (
        <span>
          Clé sur <strong>build.nvidia.com</strong>.
          <br />
          Modèles optimisés (Llama 3.1, Nemotron, etc.).
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-10">
      {showTitle && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-4">
            <BrainCircuit size={20} className="text-gold" />
            Intelligence Artificielle
          </h2>
          <p className="text-caption font-medium text-label/40 leading-relaxed max-w-2xl">
            Configurez vos accès aux modèles de langage pour l&apos;assistant financier et la
            catégorisation automatique.
          </p>
        </div>
      )}

      <div className="space-y-8">
        <div className="space-y-4">
          <span className="text-caption font-semibold text-label/30 ml-1">Fournisseur</span>
          <div className="flex flex-wrap gap-4">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setApiKeys({ ...apiKeys, provider: p.id })}
                className={`flex-1 min-w-[120px] py-4 rounded-lg border font-semibold text-caption transition-all ${
                  apiKeys.provider === p.id
                    ? 'bg-label text-bg border-label shadow-lg shadow-white/5'
                    : 'bg-white/5 border-separator text-label/40 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <label htmlFor="ai-api-key" className="text-caption font-semibold text-label/30 ml-1">
            Clé API
          </label>
          <input
            id="ai-api-key"
            type="password"
            value={apiKeys.gemini}
            onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
            placeholder={apiKeys.provider === 'gemini' ? 'AIza...' : 'sk-...'}
            className="w-full bg-white/5 border border-separator rounded-lg px-6 py-4 text-white text-sm focus:outline-none focus:border-gold/50 transition-colors font-mono"
          />
          <p className="text-caption text-label/40 leading-relaxed ml-1">{getHint()}</p>
        </div>

        {apiKeys.provider !== 'gemini' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <label htmlFor="ai-model" className="text-caption font-semibold text-label/30 ml-1">
                Modèle (ID)
              </label>
              <input
                id="ai-model"
                type="text"
                value={apiKeys.model}
                onChange={(e) => setApiKeys({ ...apiKeys, model: e.target.value })}
                placeholder={
                  apiKeys.provider === 'openai'
                    ? 'gpt-4o-mini'
                    : apiKeys.provider === 'openrouter'
                      ? 'google/gemini-2.0-flash-001'
                      : 'meta/llama-3.1-8b-instruct'
                }
                className="w-full bg-white/5 border border-separator rounded-lg px-6 py-4 text-white text-sm focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>

            <div className="space-y-4">
              <label
                htmlFor="ai-base-url"
                className="text-caption font-semibold text-label/30 ml-1"
              >
                URL de base (Optionnel)
              </label>
              <input
                id="ai-base-url"
                type="text"
                value={apiKeys.baseUrl}
                onChange={(e) => setApiKeys({ ...apiKeys, baseUrl: e.target.value })}
                placeholder={
                  apiKeys.provider === 'nvidia'
                    ? 'https://integrate.api.nvidia.com/v1'
                    : apiKeys.provider === 'openrouter'
                      ? 'https://openrouter.ai/api/v1'
                      : 'https://api.openai.com/v1'
                }
                className="w-full bg-white/5 border border-separator rounded-lg px-6 py-4 text-white text-sm focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
          </motion.div>
        )}

        <Button
          variant="primary"
          onClick={saveApiKeys}
          className="w-full py-4 rounded-lg bg-gold text-bg font-semibold text-caption shadow-lg shadow-gold/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          Enregistrer & Redémarrer
        </Button>
      </div>
    </div>
  );
};
