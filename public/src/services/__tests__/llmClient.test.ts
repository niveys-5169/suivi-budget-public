import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini, callOpenAICompatible, describeHttpError } from '../llmClient';
import type { AIConfig } from '../../utils/aiConfig';

const openaiConfig: AIConfig = {
  provider: 'openai',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  baseUrl: null,
};

const geminiConfig: AIConfig = {
  provider: 'gemini',
  apiKey: 'AIza-test',
  model: null,
  baseUrl: null,
};

/** Construit une réponse fetch minimale (ok/status/json). */
function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('describeHttpError', () => {
  it('classe 401 comme clé invalide, non rejouable', () => {
    expect(describeHttpError(401, 'OpenAI')).toEqual({
      message: expect.stringContaining('Clé API OpenAI invalide'),
      retryable: false,
    });
  });

  it('classe 429 (quota) comme rejouable', () => {
    const res = describeHttpError(429, 'Gemini');
    expect(res.retryable).toBe(true);
    expect(res.message).toContain('quota');
  });

  it('classe 5xx comme rejouable', () => {
    expect(describeHttpError(503, 'NVIDIA').retryable).toBe(true);
  });

  it('inclut le détail API pour 400', () => {
    expect(describeHttpError(400, 'OpenAI', 'unknown model').message).toContain('unknown model');
  });
});

describe('callOpenAICompatible', () => {
  it('renvoie le texte en cas de succès (un seul appel)', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, { choices: [{ message: { content: 'Bonjour' } }] }),
    );
    const res = await callOpenAICompatible(openaiConfig, 'sys', [], 'question');
    expect(res).toBe('Bonjour');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('échoue immédiatement sur 401 sans réessayer', async () => {
    fetchMock.mockResolvedValue(mockResponse(401, { error: { message: 'invalid key' } }));
    await expect(callOpenAICompatible(openaiConfig, 'sys', [], 'q')).rejects.toThrow(
      /Clé API OpenAI invalide/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('réessaie sur 429 (quota) puis échoue avec un message précis', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(mockResponse(429, {}));
    const p = callOpenAICompatible(openaiConfig, 'sys', [], 'q').catch((e: Error) => e);
    await vi.runAllTimersAsync();
    const err = (await p) as Error;
    expect(err.message).toContain('quota');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('réessaie sur 500 puis échoue (service indisponible)', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(mockResponse(500, {}));
    const p = callOpenAICompatible(openaiConfig, 'sys', [], 'q').catch((e: Error) => e);
    await vi.runAllTimersAsync();
    const err = (await p) as Error;
    expect(err.message).toContain('indisponible');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('traduit une erreur réseau en message lisible et rejouable', async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const p = callOpenAICompatible(openaiConfig, 'sys', [], 'q').catch((e: Error) => e);
    await vi.runAllTimersAsync();
    const err = (await p) as Error;
    expect(err.message).toContain('Impossible de joindre OpenAI');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('traduit un timeout (AbortError) en message dédié', async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const p = callOpenAICompatible(openaiConfig, 'sys', [], 'q').catch((e: Error) => e);
    await vi.runAllTimersAsync();
    const err = (await p) as Error;
    expect(err.message).toContain("n'a pas répondu à temps");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('callGemini', () => {
  it('bascule sur le modèle suivant quand une réponse est vide', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(200, { candidates: [] }))
      .mockResolvedValueOnce(
        mockResponse(200, { candidates: [{ content: { parts: [{ text: 'Salut' }] } }] }),
      );
    const res = await callGemini(geminiConfig, 'sys', [], 'q');
    expect(res).toBe('Salut');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('échoue immédiatement sur 401 sans parcourir les autres modèles', async () => {
    fetchMock.mockResolvedValue(mockResponse(401, { error: { message: 'bad key' } }));
    await expect(callGemini(geminiConfig, 'sys', [], 'q')).rejects.toThrow(
      /Clé API Gemini invalide/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
