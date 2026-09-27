export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'nvidia';

/** Config résolue d'UN fournisseur, telle que consommée par `llmClient`. */
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string | null;
  baseUrl: string | null;
  /** Clé Brave Search : recherche web par tool calling (NVIDIA). */
  searchApiKey: string;
}

/** Réglages saisis pour un fournisseur. Chaîne vide = valeur par défaut. */
export interface ProviderSettings {
  apiKey: string;
  model: string;
  baseUrl: string;
}

/** Réglages IA complets : un bloc par fournisseur + clé de recherche web. */
export interface AISettings {
  version: 2;
  providers: Record<AIProvider, ProviderSettings>;
  searchApiKey: string;
}

/** Ordre de secours : on essaie chaque fournisseur configuré dans cet ordre. */
export const AI_FALLBACK_ORDER: readonly AIProvider[] = [
  'gemini',
  'nvidia',
  'openrouter',
  'openai',
];

export const PROVIDER_META: Record<
  AIProvider,
  { label: string; defaultModel: string; defaultBaseUrl: string; keyHint: string }
> = {
  gemini: {
    label: 'Gemini',
    defaultModel: 'gemini-2.5-flash-lite',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyHint: 'Clé gratuite sur aistudio.google.com.',
  },
  nvidia: {
    label: 'NVIDIA',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    keyHint: 'Clé sur build.nvidia.com.',
  },
  openrouter: {
    label: 'OpenRouter',
    defaultModel: 'google/gemini-2.0-flash-001',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'Clé sur openrouter.ai.',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyHint: 'Clé sur platform.openai.com.',
  },
};

const STORAGE_KEY = 'ai_settings';
const LEGACY_KEYS = ['ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url'] as const;

const isProvider = (v: unknown): v is AIProvider =>
  typeof v === 'string' && (AI_FALLBACK_ORDER as readonly string[]).includes(v);

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Vrai si l'URL est vide (= défaut) ou une URL http(s) absolue valide. */
export function isValidBaseUrl(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const { protocol } = new URL(url.trim());
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

export function emptyAISettings(): AISettings {
  const providers = {} as Record<AIProvider, ProviderSettings>;
  for (const p of AI_FALLBACK_ORDER) providers[p] = { apiKey: '', model: '', baseUrl: '' };
  return { version: 2, providers, searchApiKey: '' };
}

/**
 * Normalise une valeur inconnue (JSON local, document Firestore) en réglages
 * valides : champs manquants complétés, espaces retirés, URL invalides
 * écartées, fournisseurs inconnus ignorés. Ne lève jamais.
 */
export function sanitizeAISettings(raw: unknown): AISettings {
  const settings = emptyAISettings();
  if (!raw || typeof raw !== 'object') return settings;
  const obj = raw as { providers?: Record<string, unknown>; searchApiKey?: unknown };
  for (const p of AI_FALLBACK_ORDER) {
    const entry = obj.providers?.[p];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const baseUrl = str(e.baseUrl);
    settings.providers[p] = {
      apiKey: str(e.apiKey),
      model: str(e.model),
      baseUrl: isValidBaseUrl(baseUrl) ? baseUrl : '',
    };
  }
  settings.searchApiKey = str(obj.searchApiKey);
  return settings;
}

/** Convertit l'ancien format (un seul fournisseur à plat) vers le nouveau. */
export function migrateLegacyAISettings(legacy: {
  provider?: unknown;
  apiKey?: unknown;
  model?: unknown;
  baseUrl?: unknown;
  searchApiKey?: unknown;
}): AISettings {
  const provider = isProvider(legacy.provider) ? legacy.provider : 'gemini';
  return sanitizeAISettings({
    providers: {
      [provider]: { apiKey: legacy.apiKey, model: legacy.model, baseUrl: legacy.baseUrl },
    },
    searchApiKey: legacy.searchApiKey,
  });
}

/** Lit les réglages locaux ; migre l'ancien format si besoin. */
export function readAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizeAISettings(JSON.parse(raw));
  } catch {
    // JSON corrompu : on retombe sur la migration / des réglages vides.
  }
  return migrateLegacyAISettings({
    provider: localStorage.getItem('ai_provider'),
    apiKey: localStorage.getItem('ai_api_key'),
    model: localStorage.getItem('ai_model'),
    baseUrl: localStorage.getItem('ai_base_url'),
    searchApiKey: localStorage.getItem('search_api_key'),
  });
}

/** Écrit les réglages locaux et supprime les anciennes clés à plat. */
export function writeAISettings(settings: AISettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeAISettings(settings)));
  for (const key of [...LEGACY_KEYS, 'search_api_key']) localStorage.removeItem(key);
}

/** Fournisseurs ayant une clé, dans l'ordre de secours. */
export function configuredProviders(settings: AISettings): AIProvider[] {
  return AI_FALLBACK_ORDER.filter((p) => settings.providers[p].apiKey);
}

/** Config d'appel d'un fournisseur (chaîne vide → null = valeur par défaut). */
export function toAIConfig(settings: AISettings, provider: AIProvider): AIConfig {
  const { apiKey, model, baseUrl } = settings.providers[provider];
  return {
    provider,
    apiKey,
    model: model || null,
    baseUrl: baseUrl || null,
    searchApiKey: settings.searchApiKey,
  };
}
