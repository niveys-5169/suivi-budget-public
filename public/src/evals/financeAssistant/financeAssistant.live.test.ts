import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { callLLMWithFallback, type LLMTool } from '../../services/llmClient';
import { AI_FALLBACK_ORDER, emptyAISettings } from '../../utils/aiConfig';
import {
  buildFinancialSummary,
  buildSystemPrompt,
  questionNeedsWebSearch,
} from '../../utils/financeQAAnalysis';
import { buildBudgetSummary } from '../../utils/budgetQAAnalysis';
import { buildFinanceTools } from '../../utils/financeTools';
import { FIXTURE_CONTEXT, FIXTURE_TODAY } from './fixture';
import { EVAL_CASES, GLOBAL_FORBIDDEN, extractNumbers } from './cases';

/**
 * Évaluation avec un vrai modèle — ignorée sans clé. Exemple :
 *   EVAL_GEMINI_API_KEY=… EVAL_GEMINI_MODEL=gemini-2.5-flash npm run eval:assistant
 * Variables reconnues : EVAL_<FOURNISSEUR>_API_KEY / _MODEL / _BASE_URL
 * (GEMINI, NVIDIA, OPENROUTER, OPENAI).
 */
const settings = emptyAISettings();
for (const p of AI_FALLBACK_ORDER) {
  const env = (suffix: string) => process.env[`EVAL_${p.toUpperCase()}_${suffix}`] ?? '';
  settings.providers[p] = { apiKey: env('API_KEY'), model: env('MODEL'), baseUrl: env('BASE_URL') };
}
const hasKey = AI_FALLBACK_ORDER.some((p) => settings.providers[p].apiKey);

describe.skipIf(!hasKey)('évaluation assistant — modèle réel', () => {
  beforeAll(() => {
    // Les prompts lisent la date du jour : on la fige sur celle de la fixture.
    vi.useFakeTimers({ now: FIXTURE_TODAY, toFake: ['Date'] });
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it.each(EVAL_CASES.map((c) => [c.id, c] as const))(
    '%s',
    async (_id, evalCase) => {
      const { transactions, baseBudgets, forecast } = FIXTURE_CONTEXT;
      const summary = buildFinancialSummary(transactions, baseBudgets, evalCase.question)!;
      const prompt = buildSystemPrompt(
        summary,
        null,
        buildBudgetSummary({ transactions, baseBudgets, forecast }),
      );
      const calls: string[] = [];
      const tools: LLMTool[] = buildFinanceTools(FIXTURE_CONTEXT).map((t) => ({
        ...t,
        run: (args) => {
          calls.push(`${t.name}(${JSON.stringify(args)})`);
          return t.run(args);
        },
      }));
      const warnings: string[] = [];

      const { text, provider } = await callLLMWithFallback(
        settings,
        prompt,
        evalCase.question,
        [],
        (w) => warnings.push(w),
        { webSearch: questionNeedsWebSearch(evalCase.question), tools },
      );

      console.info(
        [
          `[${evalCase.id}] ${provider}`,
          `outils : ${calls.join(', ') || 'aucun'}`,
          ...warnings,
          text,
        ].join('\n'),
      );

      const found = extractNumbers(text);
      for (const n of evalCase.numbers) {
        expect(
          found.some((f) => Math.abs(f - n) <= 1),
          `${n} absent de la réponse`,
        ).toBe(true);
      }
      for (const re of evalCase.mustMatch ?? []) expect(text).toMatch(re);
      for (const re of [...GLOBAL_FORBIDDEN, ...(evalCase.mustNotMatch ?? [])]) {
        expect(text).not.toMatch(re);
      }
    },
    90_000,
  );
});
