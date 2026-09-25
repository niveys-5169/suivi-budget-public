import { describe, it, expect } from 'vitest';
import { buildFinancialSummary, buildSystemPrompt } from '../../public/src/utils/financeQAAnalysis';
import type { Transaction } from '../../public/src/types/banking.types';

function tx(id: number, date: string, libelle: string, montant = -10): Transaction {
  return { id: String(id), date, libelle, montant, categorie: 'Divers' } as Transaction;
}

/** 600 transactions récentes + une vieille transaction « NETFLIX ». */
function buildHistory(): Transaction[] {
  const recent = Array.from({ length: 600 }, (_, i) => tx(i, '2026-09-01', `CB CARREFOUR ${i}`));
  return [...recent, tx(999, '2019-03-15', 'PRLV NETFLIX')];
}

describe('buildFinancialSummary', () => {
  it('agrège tout l’historique, même au-delà des transactions détaillées', () => {
    const summary = buildFinancialSummary(buildHistory())!;
    expect(summary.resume.total_transactions).toBe(601);
    expect(summary.par_annee['2019']).toEqual({ depenses: -10, recettes: 0 });
    expect(summary.transactions_detaillees).toHaveLength(500);
  });

  it('inclut les transactions anciennes correspondant à la question', () => {
    const summary = buildFinancialSummary(buildHistory(), [], 'Combien pour Netflix ?')!;
    expect(summary.transactions_detaillees).toHaveLength(500);
    expect(summary.transactions_detaillees[0]!.libelle).toBe('PRLV NETFLIX');
  });

  it('sans question, garde les transactions les plus récentes', () => {
    const summary = buildFinancialSummary(buildHistory())!;
    expect(summary.transactions_detaillees.some((t) => t.libelle === 'PRLV NETFLIX')).toBe(false);
  });
});

describe('buildSystemPrompt', () => {
  it('fournit la date du jour et autorise la recherche web pour les infos externes', () => {
    const prompt = buildSystemPrompt(buildFinancialSummary(buildHistory())!);
    expect(prompt).toContain(`Date du jour : ${new Date().toLocaleDateString('fr-CA')}`);
    expect(prompt).toContain('recherche web');
  });
});
