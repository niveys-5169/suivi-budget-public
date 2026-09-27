import { describe, it, expect } from 'vitest';
import { buildFinanceTools } from '../../utils/financeTools';
import { FIXTURE_CONTEXT } from './fixture';
import { EVAL_CASES, extractNumbers } from './cases';

/** Vérité terrain : les outils renvoient bien les chiffres attendus sur la fixture. */
describe('évaluation assistant — outils de référence', () => {
  const tools = buildFinanceTools(FIXTURE_CONTEXT);

  it.each(EVAL_CASES.map((c) => [c.id, c] as const))('%s', async (_id, evalCase) => {
    for (const ref of evalCase.reference) {
      const tool = tools.find((t) => t.name === ref.tool)!;
      const result = JSON.parse(await tool.run(ref.args));
      expect(result).toMatchObject(ref.expected);
    }
  });
});

describe('extractNumbers', () => {
  it('lit les montants au format français', () => {
    expect(extractNumbers('Solde : 11 790,57 € et 5 500 €, soit 45 %.')).toEqual([
      11790.57, 5500, 45,
    ]);
  });
});
