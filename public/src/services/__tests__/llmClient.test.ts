import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  callGemini,
  callLLM,
  callLLMWithFallback,
  callOpenAICompatible,
  describeHttpError,
} from '../llmClient';
import { emptyAISettings } from '../../utils/aiConfig';
import type { AIConfig } from '../../utils/aiConfig';

const openaiConfig: AIConfig = {
  provider: 'openai',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  baseUrl: null,
  searchApiKey: '',
};

const geminiConfig: AIConfig = {
  provider: 'gemini',
  apiKey: 'AIza-test',
  model: null,
  baseUrl: null,
  searchApiKey: '',
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

  it('concatène les parts de texte (réponse ancrée sur le web)', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, {
        candidates: [{ content: { parts: [{ text: 'Livret A : ' }, { text: '1,5 %.' }] } }],
      }),
    );
    expect(await callGemini(geminiConfig, 'sys', [], 'q')).toBe('Livret A : 1,5 %.');
  });

  it('échoue immédiatement sur 401 sans parcourir les autres modèles', async () => {
    fetchMock.mockResolvedValue(mockResponse(401, { error: { message: 'bad key' } }));
    await expect(callGemini(geminiConfig, 'sys', [], 'q')).rejects.toThrow(
      /Clé API Gemini invalide/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('callLLM — recherche web', () => {
  const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call]![1].body as string);

  it('active Google Search pour Gemini', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    );
    await callLLM(geminiConfig, 'sys', 'q');
    expect(bodyOf(0).tools).toEqual([{ google_search: {} }]);
  });

  it('active le plugin web pour OpenRouter', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { choices: [{ message: { content: 'ok' } }] }));
    await callLLM({ ...openaiConfig, provider: 'openrouter' }, 'sys', 'q');
    expect(bodyOf(0).plugins).toEqual([{ id: 'web' }]);
  });

  it('retente sans web si le fournisseur refuse (402 crédits)', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(402, { error: { message: 'Insufficient credits' } }))
      .mockResolvedValueOnce(mockResponse(200, { choices: [{ message: { content: 'ok' } }] }));
    const onWebUnavailable = vi.fn();
    const res = await callLLM(
      { ...openaiConfig, provider: 'openrouter' },
      'sys',
      'q',
      [],
      onWebUnavailable,
    );
    expect(res).toBe('ok');
    expect(bodyOf(1).plugins).toBeUndefined();
    expect(onWebUnavailable).toHaveBeenCalledWith(
      'Réponse sans accès internet : crédits OpenRouter insuffisants pour la recherche web.',
    );
  });

  it("n'envoie pas d'option web à OpenAI", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { choices: [{ message: { content: 'ok' } }] }));
    await callLLM(openaiConfig, 'sys', 'q');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(0).plugins).toBeUndefined();
  });
});

describe('callLLM — NVIDIA (tool calling + Brave Search)', () => {
  const nvidiaConfig: AIConfig = { ...openaiConfig, provider: 'nvidia', searchApiKey: 'BSA-test' };
  const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call]![1].body as string);
  const toolCallResponse = mockResponse(200, {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'recherche_web', arguments: '{"requete":"taux livret A"}' },
            },
          ],
        },
      },
    ],
  });
  const braveResponse = mockResponse(200, {
    web: {
      results: [
        { title: 'Livret <strong>A</strong>', url: 'https://ex.fr', description: 'Taux 1,5 %' },
      ],
    },
  });
  const finalResponse = mockResponse(200, {
    choices: [{ message: { content: 'Le taux est 1,5 %.' } }],
  });

  it('exécute la recherche demandée par le modèle et renvoie la réponse finale', async () => {
    fetchMock
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(braveResponse)
      .mockResolvedValueOnce(finalResponse);

    const res = await callLLM(nvidiaConfig, 'sys', 'Quel est le taux du Livret A ?');

    expect(res).toBe('Le taux est 1,5 %.');
    expect(bodyOf(0).tools[0].function.name).toBe('recherche_web');
    const [braveUrl, braveInit] = fetchMock.mock.calls[1]!;
    expect(braveUrl).toContain('/api/search/brave/res/v1/web/search?q=taux+livret+A');
    expect(braveInit.headers['X-Subscription-Token']).toBe('BSA-test');
    const toolMsg = bodyOf(2).messages.at(-1);
    expect(toolMsg).toMatchObject({ role: 'tool', tool_call_id: 'call_1' });
    expect(toolMsg.content).toContain('Livret A');
    expect(toolMsg.content).toContain('Taux 1,5 %');
  });

  it('signale une clé Brave invalide et laisse le modèle répondre sans web', async () => {
    fetchMock
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(mockResponse(401, {}))
      .mockResolvedValueOnce(finalResponse);
    const onWebUnavailable = vi.fn();

    const res = await callLLM(nvidiaConfig, 'sys', 'q', [], onWebUnavailable);

    expect(res).toBe('Le taux est 1,5 %.');
    expect(onWebUnavailable).toHaveBeenCalledWith(
      expect.stringContaining('clé Brave Search invalide'),
    );
    expect(bodyOf(2).messages.at(-1).content).toContain('Recherche impossible');
  });

  it('signale l’absence de clé Brave et n’envoie pas d’outil', async () => {
    fetchMock.mockResolvedValue(finalResponse);
    const onWebUnavailable = vi.fn();

    await callLLM({ ...nvidiaConfig, searchApiKey: '' }, 'sys', 'q', [], onWebUnavailable);

    expect(bodyOf(0).tools).toBeUndefined();
    expect(onWebUnavailable).toHaveBeenCalledWith(expect.stringContaining('clé Brave Search'));
  });

  it('retente sans outil si le modèle ne gère pas le tool calling (400)', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(400, { error: { message: 'tools not supported' } }))
      .mockResolvedValueOnce(finalResponse);
    const onWebUnavailable = vi.fn();

    await callLLM(nvidiaConfig, 'sys', 'q', [], onWebUnavailable);

    expect(bodyOf(1).tools).toBeUndefined();
    expect(onWebUnavailable).toHaveBeenCalledWith(
      'Réponse sans accès internet : modèle NVIDIA incompatible avec la recherche web.',
    );
  });
});

describe('callGemini — modèle et URL configurés', () => {
  it('essaie d’abord le modèle choisi, sur l’URL choisie', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    );
    await callGemini(
      { ...geminiConfig, model: 'gemini-2.5-pro', baseUrl: 'https://proxy.example/v1beta/' },
      'sys',
      [],
      'q',
    );
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://proxy.example/v1beta/models/gemini-2.5-pro:generateContent',
    );
  });
});

describe('callLLMWithFallback', () => {
  const settings = () => {
    const s = emptyAISettings();
    s.providers.gemini.apiKey = 'g';
    s.providers.nvidia.apiKey = 'n';
    s.providers.openrouter.apiKey = 'o';
    return s;
  };
  const ok = (text: string) => mockResponse(200, { choices: [{ message: { content: text } }] });

  it('passe à NVIDIA si Gemini échoue, et le signale', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(401, { error: { message: 'bad key' } }))
      .mockResolvedValueOnce(ok('réponse nvidia'));
    const onWarning = vi.fn();

    const res = await callLLMWithFallback(settings(), 'sys', 'q', [], onWarning);

    expect(res).toEqual({ text: 'réponse nvidia', provider: 'nvidia' });
    expect(fetchMock.mock.calls[1]![0]).toContain('nvidia');
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringMatching(/^Réponse fournie par NVIDIA \(Gemini : Clé API Gemini invalide/),
    );
  });

  it('respecte l’ordre Gemini → NVIDIA → OpenRouter', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(401, {}))
      .mockResolvedValueOnce(mockResponse(401, {}))
      .mockResolvedValueOnce(ok('réponse openrouter'));

    const res = await callLLMWithFallback(settings(), 'sys', 'q');

    expect(res.provider).toBe('openrouter');
    expect(fetchMock.mock.calls[2]![0]).toContain('openrouter.ai');
  });

  it('ignore les fournisseurs sans clé', async () => {
    const s = emptyAISettings();
    s.providers.openrouter.apiKey = 'o';
    fetchMock.mockResolvedValueOnce(ok('ok'));

    const res = await callLLMWithFallback(s, 'sys', 'q');

    expect(res.provider).toBe('openrouter');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('échoue avec le détail de chaque fournisseur si aucun ne répond', async () => {
    fetchMock.mockResolvedValue(mockResponse(401, {}));
    await expect(callLLMWithFallback(settings(), 'sys', 'q')).rejects.toThrow(
      /Aucun fournisseur IA n'a répondu\. Gemini : .* ; NVIDIA : .* ; OpenRouter : /,
    );
  });

  it('échoue clairement si aucune clé n’est configurée', async () => {
    await expect(callLLMWithFallback(emptyAISettings(), 'sys', 'q')).rejects.toThrow(
      'Clé API non configurée',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
