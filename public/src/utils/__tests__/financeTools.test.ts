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

  it('étale un paiement en 10x et contrôle le budget mois par mois', () => {
    const res = simulerDepense(
      { montant: 1200, categorie: 'Shopping', nb_mensualites: 10 },
      FIXTURE_CONTEXT,
    );
    expect(res.paiement).toMatchObject({ nb_mensualites: 10, mensualite: 120, cout_total: 1200 });
    expect(res.paiement.echeances?.at(-1)).toEqual({ date: '2027-06-27', montant: 120 });
    // Habituel : (12 × 35 + 250) / 12 = 55,83 € ; septembre réel : 35 €.
    expect(res.budget_categorie).toMatchObject({
      depense_mensuelle_habituelle: 55.83,
      reste_apres: -55,
    });
    expect(res.raisons[0]).toMatch(/10 mois sur 10 \(jusqu'à 75.83 €\)/);
    // Seules les 4 échéances de 2026 pèsent sur la marge annuelle.
    const marge = res.marge_annuelle!;
    expect(marge.solde_net_annuel_projete_avant - marge.solde_net_annuel_projete_apres).toBeCloseTo(
      480,
    );
  });

  it('le paiement fractionné peut éviter le passage sous zéro', () => {
    const args = { montant: 5500, date: '2026-10-01' };
    expect(simulerDepense(args, FIXTURE_CONTEXT).verdict).toBe('non');
    const tenTimes = simulerDepense({ ...args, nb_mensualites: 10 }, FIXTURE_CONTEXT);
    expect(tenTimes.tresorerie.apres.date_passage_negatif).toBeNull();
  });

  it('borne les échéances en fin de mois et répartit les centimes', () => {
    const res = simulerDepense(
      { montant: 100, date: '2026-01-31', nb_mensualites: 3 },
      FIXTURE_CONTEXT,
    );
    expect(res.paiement.echeances).toEqual([
      { date: '2026-01-31', montant: 33.33 },
      { date: '2026-02-28', montant: 33.33 },
      { date: '2026-03-31', montant: 33.34 },
    ]);
  });

  it('refuse un montant invalide', () => {
    expect(() => simulerDepense({}, FIXTURE_CONTEXT)).toThrow(/montant/);
  });
});
