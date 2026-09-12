import type { AIConfig, AIProvider } from '../utils/aiConfig';
import type { FinancialSummary } from '../utils/financeQAAnalysis';

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
export const OPENAI_MODEL = 'gpt-4o-mini';
export const OPENROUTER_DEFAULT_MODEL = 'google/gemini-2.0-flash-001';
export const NVIDIA_DEFAULT_MODEL = 'meta/llama-3.1-8b-instruct';
export const NVIDIA_DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/** Délai maximal d'attente d'une réponse LLM avant abandon (ms). */
export const AI_REQUEST_TIMEOUT_MS = 30_000;
/** Nombre de tentatives (1 + 2 retries) pour les erreurs transitoires. */
const AI_MAX_ATTEMPTS = 3;
const AI_RETRY_BASE_DELAY_MS = 600;

interface AIErrorResponse {
  error?: { message?: string };
}

interface OpenAIRequestBody {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens: number;
}

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
  };

  const label = PROVIDER_LABELS.gemini;

  // Un « essai » = parcours de la liste de modèles de secours. Le retry externe
  // ne relance que sur erreur transitoire (429/5xx/réseau) ; les erreurs d'auth
  // ou de requête échouent immédiatement sans épuiser les 4 modèles.
  return requestWithRetry(async () => {
    let lastError = new AIError(`Aucun modèle ${label} disponible.`);

    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = new AIError('Réponse vide de Gemini. Réessaie ou change de modèle.');
        continue;
      }
      return text;
    }

    throw lastError;
  });
}

export interface CallOptions {
  baseUrl?: string;
  model?: string;
  extraHeaders?: Record<string, string>;
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
  } = options;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: question },
  ];

  const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
  const label = PROVIDER_LABELS[config.provider] ?? 'IA';

  const body: OpenAIRequestBody = {
    model,
    messages,
    max_tokens: model.includes('nvidia') || baseUrl.includes('nvidia') ? 1024 : 2048,
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
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new AIError(`Réponse vide de ${label}. Réessaie ou change de modèle.`);
    return text;
  });
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
): Promise<string> {
  if (config.provider === 'gemini') {
    return callGemini(config, systemPrompt, history, question);
  }

  const options: CallOptions = {
    model: config.model ?? undefined,
    baseUrl: config.baseUrl ?? undefined,
    extraHeaders: {},
  };

  if (config.provider === 'openrouter') {
    options.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
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
  } else if (config.provider === 'openai') {
    options.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    options.model = config.model || OPENAI_MODEL;
  }

  return callOpenAICompatible(config, systemPrompt, history, question, options);
}

export type { FinancialSummary };
