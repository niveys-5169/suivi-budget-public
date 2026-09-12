export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'nvidia';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string | null;
  baseUrl: string | null;
}

export function readAIConfig(): AIConfig {
  return {
    provider: (localStorage.getItem('ai_provider') || 'gemini') as AIProvider,
    apiKey: localStorage.getItem('ai_api_key') || '',
    model: localStorage.getItem('ai_model'),
    baseUrl: localStorage.getItem('ai_base_url'),
  };
}
