import { describe, it, expect } from 'vitest';
import { computeTotaux, simulerDepense } from '../financeTools';
import { FIXTURE_CONTEXT } from '../../evals/financeAssistant/fixture';

describe('computeTotaux', () => {
  it('refuse un mois mal formé', () => {
    expect(() => computeTotaux({ debut: 'août 2026' }, FIXTURE_CONTEXT)).toThrow(/YYYY-MM/);
  });

  it('exclut virements internes et épargne sans filtre, les inclut si demandés', () => {
    const all = computeTotaux({ debut: '2026-08', fin: '2026-08' }, FIXTURE_CONTEXT);
    const transfers = computeTotaux(
      { debut: '2026-08', fin: '2026-08', categorie: 'virement interne' },
      FIXTURE_CONTEXT,
    );
    expect(all.depenses).toBeCloseTo(1458.49 + 1200); // dépenses courantes + Airbnb
    expect(transfers).toMatchObject({ depenses: 500, nb_transactions: 1 });
  });

  it('liste les catégories connues quand la catégorie demandée est introuvable', () => {
    const res = computeTotaux({ categorie: 'Resto' }, FIXTURE_CONTEXT);
    expect(res.nb_transactions).toBe(0);
    expect(res.categories_disponibles).toContain('Restaurants');
  });
});

describe('simulerDepense', () => {
  it('signale le dépassement du budget de la catégorie', () => {
    const res = simulerDepense({ montant: 100, categorie: 'Courses' }, FIXTURE_CONTEXT);
    expect(res.verdict).toBe('oui_mais');
    expect(res.budget_categorie).toMatchObject({
      type: 'mensuel',
      reste_avant: 45,
      reste_apres: -55,
    });
    expect(res.raisons[0]).toMatch(/Courses.*55 €/);
  });

  it('impute un achat à son enveloppe annuelle', () => {
    const res = simulerDepense({ montant: 400, categorie: 'vacances' }, FIXTURE_CONTEXT);
    expect(res.budget_categorie).toMatchObject({ type: 'enveloppe', reste_apres: 1100 });
    expect(res.verdict).toBe('oui');
  });

  it('refuse un montant invalide', () => {
    expect(() => simulerDepense({}, FIXTURE_CONTEXT)).toThrow(/montant/);
  });
});
