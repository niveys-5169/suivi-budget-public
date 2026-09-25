import {
  PROVIDER_META,
  configuredProviders,
  toAIConfig,
  type AIConfig,
  type AIProvider,
  type AISettings,
} from '../utils/aiConfig';
import type { FinancialSummary } from '../utils/financeQAAnalysis';
import { searchWeb as braveSearch } from './webSearch';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-3.1-flash-lite',
];
export const OPENAI_MODEL = PROVIDER_META.openai.defaultModel;
export const OPENROUTER_DEFAULT_MODEL = PROVIDER_META.openrouter.defaultModel;
export const NVIDIA_DEFAULT_MODEL = PROVIDER_META.nvidia.defaultModel;
export const NVIDIA_DEFAULT_BASE_URL = PROVIDER_META.nvidia.defaultBaseUrl;

/** Délai maximal d'attente d'une réponse LLM avant abandon (ms). */
export const AI_REQUEST_TIMEOUT_MS = 30_000;
/** Nombre de tentatives (1 + 2 retries) pour les erreurs transitoires. */
const AI_MAX_ATTEMPTS = 3;
const AI_RETRY_BASE_DELAY_MS = 600;
/** Budget de sortie Gemini : assez large pour éviter les réponses coupées net. */
const GEMINI_MAX_OUTPUT_TOKENS = 1024;

/**
 * Nettoie la sortie brute d'un LLM : supprime les blocs de raisonnement
 * interne (`<think>…</think>`) que certains modèles exposent, et les espaces
 * parasites. Le reste du texte est renvoyé tel quel.
 */
export function sanitizeLLMText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, '')
    .replace(/^\s+/, '')
    .trimEnd();
}

interface AIErrorResponse {
  error?: { message?: string };
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIRequestBody {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  plugins?: { id: string }[];
  tools?: unknown[];
  tool_choice?: 'auto';
}

/** Outil de recherche web exposé aux modèles qui gèrent le tool calling. */
const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'recherche_web',
    description:
      "Recherche sur internet des informations à jour (taux d'épargne, inflation, cours de bourse, actualité, fiscalité…). Ne sert pas pour les données personnelles de l'utilisateur, déjà fournies.",
    parameters: {
      type: 'object',
      properties: { requete: { type: 'string', description: 'Requête de recherche.' } },
      required: ['requete'],
    },
  },
};
/** Nombre maximal d'allers-retours outil → modèle avant réponse forcée. */
const MAX_TOOL_ROUNDS = 3;

/** Libellés lisibles par fournisseur, utilisés dans les messages d'erreur. */
const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  nvidia: 'NVIDIA',
};

/**
 * Erreur d'appel LLM porteuse d'un code HTTP et d'un flag `retryable`.
 * Sous-classe d'`Error` : le message reste lisible tel quel par l'appelant.
 */
export class AIError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, opts: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = 'AIError';
    this.retryable = opts.retryable ?? false;
    this.status = opts.status;
  }
}

/**
 * Traduit un code HTTP en message français précis et actionnable, et indique
 * si l'erreur est transitoire (donc rejouable).
 */
export function describeHttpError(
  status: number,
  providerLabel: string,
  apiMessage?: string,
): { message: string; retryable: boolean } {
  if (status === 400) {
    const detail = apiMessage ? ` : ${apiMessage}` : '';
    return {
      message: `Requête refusée par ${providerLabel} (modèle ou paramètres invalides)${detail}.`,
      retryable: false,
    };
  }
  if (status === 401 || status === 403) {
    return {
      message: `Clé API ${providerLabel} invalide ou non autorisée. Vérifie ta clé dans ⚙.`,
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      message: `Modèle ${providerLabel} introuvable. Vérifie l'identifiant du modèle dans ⚙.`,
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      message: `Limite de requêtes ${providerLabel} atteinte (quota). Réessaie dans un instant.`,
      retryable: true,
    };
  }
  if (status >= 500) {
    return {
      message: `${providerLabel} est momentanément indisponible (${status}). Réessaie.`,
      retryable: true,
    };
  }
  return {
    message: apiMessage || `Erreur ${providerLabel} (${status}).`,
    retryable: false,
  };
}

/**
 * `fetch` enveloppé d'un timeout (`AbortController`). Traduit les échecs bas
 * niveau (timeout, coupure réseau/CORS) en `AIError` retryable et lisible.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  providerLabel: string,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError(
        `${providerLabel} n'a pas répondu à temps (${Math.round(timeoutMs / 1000)} s). Réessaie.`,
        { retryable: true },
      );
    }
    throw new AIError(
      `Impossible de joindre ${providerLabel} (réseau ou connexion). Vérifie ta connexion internet.`,
      { retryable: true },
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rejoue `fn` en backoff exponentiel, mais uniquement sur les `AIError`
 * marquées `retryable` (429, 5xx, réseau, timeout). Les autres erreurs
 * (clé invalide, 400, 404) échouent immédiatement.
 */
async function requestWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = err instanceof AIError && err.retryable;
      if (!retryable || attempt === AI_MAX_ATTEMPTS) throw err;
      const delay = AI_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function callGemini(
  config: AIConfig,
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
  webSearch = false,
): Promise<string> {
  const contents = [
    ...history.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    { role: 'user', parts: [{ text: question }] },
  ];

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      topK: 20,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    },
    // Ancrage Google Search : le modèle décide seul s'il a besoin du web.
    ...(webSearch ? { tools: [{ google_search: {} }] } : {}),
  };

  const label = PROVIDER_LABELS.gemini;
  const baseUrl = (config.baseUrl || PROVIDER_META.gemini.defaultBaseUrl).replace(/\/+$/, '');
  // Le modèle choisi passe en premier, la liste intégrée sert de secours.
  const models = config.model
    ? [config.model, ...GEMINI_MODELS.filter((m) => m !== config.model)]
    : GEMINI_MODELS;

  // Un « essai » = parcours de la liste de modèles de secours. Le retry externe
  // ne relance que sur erreur transitoire (429/5xx/réseau) ; les erreurs d'auth
  // ou de requête échouent immédiatement sans épuiser les 4 modèles.
  return requestWithRetry(async () => {
    let lastError = new AIError(`Aucun modèle ${label} disponible.`);

    for (const model of models) {
      const url = `${baseUrl}/models/${model}:generateContent`;
      const resp = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
          body: JSON.stringify(body),
        },
        label,
      );

      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({}))) as AIErrorResponse;
        const { message, retryable } = describeHttpError(resp.status, label, err.error?.message);
        const aiErr = new AIError(message, { retryable, status: resp.status });
        // 404 = modèle inconnu → on tente le suivant. Auth/quota/panne → on
        // arrête (relayé au retry externe si transitoire).
        if (resp.status === 404) {
          lastError = aiErr;
          continue;
        }
        throw aiErr;
      }

      const data = await resp.json();
      const candidate = data?.candidates?.[0];
      // Avec l'ancrage web, la réponse peut être répartie sur plusieurs parts.
      const parts: { text?: string }[] = candidate?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? '').join('');
      if (!text) {
        lastError = new AIError('Réponse vide de Gemini. Réessaie ou change de modèle.');
        continue;
      }
      return sanitizeLLMText(text);
    }

    throw lastError;
  });
}

export interface CallOptions {
  baseUrl?: string;
  model?: string;
  extraHeaders?: Record<string, string>;
  temperature?: number;
  top_p?: number;
  /** OpenRouter uniquement : active le plugin de recherche web. */
  webSearch?: boolean;
  /** Expose l'outil `recherche_web` au modèle (tool calling) et l'exécute. */
  searchWeb?: (query: string) => Promise<string>;
}

export async function callOpenAICompatible(
  config: AIConfig,
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
  options: CallOptions = {},
): Promise<string> {
  const {
    baseUrl = 'https://api.openai.com/v1',
    model = OPENAI_MODEL,
    extraHeaders = {},
    temperature = 0.2,
    top_p = 0.8,
    webSearch = false,
    searchWeb,
  } = options;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: question },
  ];

  const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
  const label = PROVIDER_LABELS[config.provider] ?? 'IA';

  const maxTokens = model.includes('nvidia') || baseUrl.includes('nvidia') ? 1024 : 2048;

  const request = (withTools: boolean) => {
    const body: OpenAIRequestBody = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p,
      ...(webSearch ? { plugins: [{ id: 'web' }] } : {}),
      ...(withTools ? { tools: [WEB_SEARCH_TOOL], tool_choice: 'auto' as const } : {}),
    };

    return requestWithRetry(async () => {
      const resp = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
            ...extraHeaders,
          },
          body: JSON.stringify(body),
        },
        label,
      );

      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({}))) as AIErrorResponse;
        const { message, retryable } = describeHttpError(resp.status, label, err.error?.message);
        throw new AIError(message, { retryable, status: resp.status });
      }

      const data = await resp.json();
      return data?.choices?.[0]?.message as OpenAIMessage | undefined;
    });
  };

  // Boucle de tool calling : le modèle peut demander des recherches web, dont
  // on lui renvoie les résultats, jusqu'à MAX_TOOL_ROUNDS fois.
  for (let round = 0; ; round++) {
    const withTools = !!searchWeb && round < MAX_TOOL_ROUNDS;
    const message = await request(withTools);
    const toolCalls = message?.tool_calls ?? [];

    if (withTools && searchWeb && toolCalls.length) {
      messages.push({ role: 'assistant', content: message?.content ?? '', tool_calls: toolCalls });
      for (const call of toolCalls) {
        let result: string;
        try {
          const { requete } = JSON.parse(call.function.arguments || '{}') as { requete?: string };
          result = requete ? await searchWeb(requete) : 'Requête vide.';
        } catch (err) {
          result = `Recherche impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}.`;
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
      continue;
    }

    const text = message?.content;
    if (!text) throw new AIError(`Réponse vide de ${label}. Réessaie ou change de modèle.`);
    return sanitizeLLMText(text);
  }
}

/**
 * Dispatcher unique : appelle le bon backend selon `config.provider` et applique
 * les valeurs par défaut de modèle/baseUrl/headers propres à chaque fournisseur.
 * Source unique de la sélection de provider (réutilisée par le Q&A et le RAG).
 */
export async function callLLM(
  config: AIConfig,
  systemPrompt: string,
  question: string,
  history: ChatMessage[] = [],
  onWebUnavailable?: (message: string) => void,
): Promise<string> {
  // Recherche web (Gemini, OpenRouter, NVIDIA via Brave Search) : si le
  // fournisseur la refuse (modèle incompatible 400, crédits insuffisants 402),
  // on retente sans web plutôt que de priver l'utilisateur de réponse, et on
  // le signale via le callback.
  if (config.provider === 'nvidia' && !config.searchApiKey) {
    onWebUnavailable?.(
      'Réponse sans accès internet : ajoute une clé Brave Search dans ⚙ pour NVIDIA.',
    );
  } else if (config.provider !== 'openai') {
    try {
      return await callProvider(config, systemPrompt, question, history, true, onWebUnavailable);
    } catch (err) {
      if (!(err instanceof AIError && (err.status === 400 || err.status === 402))) throw err;
      const label = PROVIDER_LABELS[config.provider];
      const reason =
        err.status === 402
          ? `crédits ${label} insuffisants pour la recherche web`
          : `modèle ${label} incompatible avec la recherche web`;
      onWebUnavailable?.(`Réponse sans accès internet : ${reason}.`);
    }
  }
  return callProvider(config, systemPrompt, question, history, false, onWebUnavailable);
}

async function callProvider(
  config: AIConfig,
  systemPrompt: string,
  question: string,
  history: ChatMessage[],
  webSearch: boolean,
  onWebUnavailable?: (message: string) => void,
): Promise<string> {
  if (config.provider === 'gemini') {
    return callGemini(config, systemPrompt, history, question, webSearch);
  }

  const options: CallOptions = {
    model: config.model ?? undefined,
    baseUrl: config.baseUrl ?? undefined,
    extraHeaders: {},
    webSearch,
  };

  if (config.provider === 'openrouter') {
    options.baseUrl = config.baseUrl || PROVIDER_META.openrouter.defaultBaseUrl;
    options.model = config.model || OPENROUTER_DEFAULT_MODEL;
    options.extraHeaders = { 'HTTP-Referer': window.location.origin, 'X-Title': 'Suivi Budget' };
  } else if (config.provider === 'nvidia') {
    // NVIDIA Build ne renvoie pas d'en-têtes CORS : un appel direct depuis le
    // navigateur est bloqué en production. On force donc le proxy Vercel
    // (voir vercel.json) dès que l'URL de base pointe vers NVIDIA, même si
    // elle a été saisie/enregistrée explicitement dans les réglages.
    const pointsToNvidia = !config.baseUrl || config.baseUrl.includes('integrate.api.nvidia.com');
    options.baseUrl =
      pointsToNvidia && window.location.hostname !== 'localhost'
        ? '/api/ai/nvidia/v1'
        : config.baseUrl || NVIDIA_DEFAULT_BASE_URL;
    options.model = config.model || NVIDIA_DEFAULT_MODEL;
    // NVIDIA ne cherche pas lui-même : il demande l'outil, l'app interroge Brave.
    options.webSearch = false;
    if (webSearch) {
      options.searchWeb = async (query) => {
        try {
          return await braveSearch(query, config.searchApiKey);
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'erreur inconnue';
          onWebUnavailable?.(`Recherche web impossible : ${reason}.`);
          throw err;
        }
      };
    }
  } else if (config.provider === 'openai') {
    options.baseUrl = config.baseUrl || PROVIDER_META.openai.defaultBaseUrl;
    options.model = config.model || OPENAI_MODEL;
  }

  return callOpenAICompatible(config, systemPrompt, history, question, options);
}

/**
 * Appelle les fournisseurs configurés dans l'ordre de secours (Gemini →
 * NVIDIA → OpenRouter → OpenAI) jusqu'au premier qui répond. Les avertissements
 * (web indisponible…) ne sont relayés que pour le fournisseur qui a répondu,
 * suivis d'une mention si un secours a pris le relais.
 */
export async function callLLMWithFallback(
  settings: AISettings,
  systemPrompt: string,
  question: string,
  history: ChatMessage[] = [],
  onWarning?: (message: string) => void,
): Promise<{ text: string; provider: AIProvider }> {
  const chain = configuredProviders(settings);
  if (!chain.length) throw new AIError('Clé API non configurée. Va dans ⚙ pour configurer.');

  const failures: string[] = [];
  for (const provider of chain) {
    const warnings: string[] = [];
    try {
      const text = await callLLM(
        toAIConfig(settings, provider),
        systemPrompt,
        question,
        history,
        (w) => warnings.push(w),
      );
      warnings.forEach((w) => onWarning?.(w));
      if (failures.length) {
        onWarning?.(`Réponse fournie par ${PROVIDER_LABELS[provider]} (${failures.join(' ; ')}).`);
      }
      return { text, provider };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'erreur inconnue';
      failures.push(`${PROVIDER_LABELS[provider]} : ${reason}`);
    }
  }
  throw new AIError(`Aucun fournisseur IA n'a répondu. ${failures.join(' ; ')}`);
}

export type { FinancialSummary };
