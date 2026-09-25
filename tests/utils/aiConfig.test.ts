import { describe, it, expect, beforeEach } from 'vitest';
import {
  configuredProviders,
  emptyAISettings,
  isValidBaseUrl,
  readAISettings,
  sanitizeAISettings,
  toAIConfig,
  writeAISettings,
} from '../../public/src/utils/aiConfig';

beforeEach(() => localStorage.clear());

describe('aiConfig', () => {
  it('relit exactement ce qui a été écrit, pour chaque fournisseur', () => {
    const settings = emptyAISettings();
    settings.providers.gemini = { apiKey: 'g', model: 'gemini-2.5-flash', baseUrl: '' };
    settings.providers.nvidia = { apiKey: 'n', model: '', baseUrl: 'https://nv.example/v1' };
    settings.searchApiKey = 'brave';
    writeAISettings(settings);
    expect(readAISettings()).toEqual(settings);
  });

  it("migre l'ancien format à plat et supprime les anciennes clés à l'écriture", () => {
    localStorage.setItem('ai_provider', 'openrouter');
    localStorage.setItem('ai_api_key', 'or-key');
    localStorage.setItem('ai_model', 'x/y');
    localStorage.setItem('search_api_key', 'brave');

    const settings = readAISettings();
    expect(settings.providers.openrouter).toEqual({ apiKey: 'or-key', model: 'x/y', baseUrl: '' });
    expect(settings.providers.gemini.apiKey).toBe('');
    expect(settings.searchApiKey).toBe('brave');

    writeAISettings(settings);
    expect(localStorage.getItem('ai_api_key')).toBeNull();
    expect(localStorage.getItem('search_api_key')).toBeNull();
    expect(readAISettings()).toEqual(settings);
  });

  it('résiste à un JSON corrompu ou mal typé', () => {
    localStorage.setItem('ai_settings', '{pas du json');
    expect(readAISettings()).toEqual(emptyAISettings());

    const s = sanitizeAISettings({
      providers: {
        gemini: { apiKey: '  k  ', model: 42, baseUrl: 'javascript:alert(1)' },
        inconnu: { apiKey: 'x' },
      },
    });
    expect(s.providers.gemini).toEqual({ apiKey: 'k', model: '', baseUrl: '' });
    expect(Object.keys(s.providers)).toEqual(['gemini', 'nvidia', 'openrouter', 'openai']);
  });

  it('valide les URL d’endpoint', () => {
    expect(isValidBaseUrl('')).toBe(true);
    expect(isValidBaseUrl('https://api.example/v1')).toBe(true);
    expect(isValidBaseUrl('ftp://x')).toBe(false);
    expect(isValidBaseUrl('pas une url')).toBe(false);
  });

  it('ordonne les fournisseurs configurés : Gemini → NVIDIA → OpenRouter → OpenAI', () => {
    const settings = emptyAISettings();
    settings.providers.openrouter.apiKey = 'o';
    settings.providers.gemini.apiKey = 'g';
    settings.providers.nvidia.apiKey = 'n';
    expect(configuredProviders(settings)).toEqual(['gemini', 'nvidia', 'openrouter']);
    expect(toAIConfig(settings, 'nvidia')).toMatchObject({
      apiKey: 'n',
      model: null,
      baseUrl: null,
    });
  });
});
