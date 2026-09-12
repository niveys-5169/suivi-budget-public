import { describe, it, expect } from 'vitest';
import { searchGlobal } from '../../public/src/utils/searchGlobal';

const PAGES = [
  { label: 'Budget', tab: 'budget' },
  { label: 'Patrimoine', tab: 'wealth' },
  { label: 'Abonnements', tab: 'recurring' },
  { label: 'Automatisations', tab: 'rules' },
  { label: 'Transactions', tab: 'flux' },
  { label: 'Analyses', tab: 'insights' },
];

function makeTx(libelle: string, categorie: string, montant: number) {
  return {
    id: Math.random().toString(),
    libelle,
    montant,
    compte: 'CCP',
    date: '2026-05-01',
    categorie,
  };
}

describe('searchGlobal', () => {
  it('retourne des résultats de type transaction filtrés par libellé', () => {
    const transactions = [makeTx('NETFLIX FRANCE', 'Loisirs', -15.99)];
    const results = searchGlobal('netflix', transactions, PAGES);
    const txResults = results.filter((r) => r.type === 'transaction');
    expect(txResults).toHaveLength(1);
    expect(txResults[0]!.label).toBe('NETFLIX FRANCE');
  });

  it('retourne des résultats de type page filtrés par label', () => {
    const results = searchGlobal('budget', [], PAGES);
    const pageResults = results.filter((r) => r.type === 'page');
    expect(pageResults).toHaveLength(1);
    expect(pageResults[0]!.tab).toBe('budget');
  });

  it('retourne des résultats de type category depuis les transactions', () => {
    const transactions = [
      makeTx('CARREFOUR', 'Alimentation', -50),
      makeTx('LIDL', 'Alimentation', -30),
    ];
    const results = searchGlobal('ali', transactions, PAGES);
    const catResults = results.filter((r) => r.type === 'category');
    expect(catResults).toHaveLength(1);
    expect(catResults[0]!.label).toBe('Alimentation');
  });

  it('retourne un tableau vide pour une query vide', () => {
    const transactions = [makeTx('AMAZON', 'Shopping', -29)];
    const results = searchGlobal('', transactions, PAGES);
    expect(results).toHaveLength(0);
  });

  it('retourne un tableau vide pour une query trop courte (< 2 chars)', () => {
    const results = searchGlobal('a', [], PAGES);
    expect(results).toHaveLength(0);
  });

  it('limite les résultats transactions à 5', () => {
    const transactions = Array.from({ length: 10 }, (_, i) =>
      makeTx(`AMAZON ACHAT ${i}`, 'Shopping', -10),
    );
    const results = searchGlobal('amazon', transactions, PAGES);
    expect(results.filter((r) => r.type === 'transaction').length).toBeLessThanOrEqual(5);
  });

  it('la recherche est insensible à la casse', () => {
    const transactions = [makeTx('Netflix France', 'Loisirs', -15.99)];
    const results = searchGlobal('NETFLIX', transactions, PAGES);
    expect(results.filter((r) => r.type === 'transaction')).toHaveLength(1);
  });

  it('retourne plusieurs types de résultats pour une query ambiguë', () => {
    const transactions = [makeTx('BUDGET DIRECT', 'Assurance', -20)];
    const results = searchGlobal('budget', transactions, PAGES);
    const types = new Set(results.map((r) => r.type));
    expect(types.has('page')).toBe(true);
    expect(types.has('transaction')).toBe(true);
  });
});
