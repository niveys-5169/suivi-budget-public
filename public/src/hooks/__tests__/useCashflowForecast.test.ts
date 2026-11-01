import { describe, it, expect } from 'vitest';
import { buildDeclaredSalaryIncomes } from '../useCashflowForecast';

describe('buildDeclaredSalaryIncomes', () => {
  const salaires = {
    nico: { categorie: 'Salaire Nico', montant: 2500 },
    gwen: { categorie: 'Salaire Gwen', montant: 1800 },
  };

  it('utilise le montant déclaré et le calendrier de la récurrence correspondante', () => {
    const incomes = buildDeclaredSalaryIncomes(salaires, null, [
      {
        key: 'rec-nico',
        label: 'VIR SALAIRE ACME',
        category: 'Salaire Nico',
        dayOfMonth: 28,
        occurrenceDates: ['2026-11-28'],
      },
    ]);

    expect(incomes).toEqual([
      {
        key: 'nico',
        label: 'Salaire Nico',
        amount: 2500,
        dayOfMonth: 28,
        occurrenceDates: ['2026-11-28'],
      },
      { key: 'gwen', label: 'Salaire Gwen', amount: 1800, dayOfMonth: 1 },
    ]);
  });

  it("n'inclut aucun revenu récurrent qui n'est pas un salaire déclaré", () => {
    const incomes = buildDeclaredSalaryIncomes({}, null, [
      {
        key: 'rec-caf',
        label: 'CAF',
        category: 'CAF',
        dayOfMonth: 5,
        occurrenceDates: ['2026-11-05'],
      },
    ]);

    expect(incomes).toEqual([]);
  });

  it("ne projette pas le salaire d'un mois déjà perçu (récurrence sans échéance restante)", () => {
    const incomes = buildDeclaredSalaryIncomes({ nico: salaires.nico }, null, [
      {
        key: 'rec-nico',
        label: 'Salaire',
        category: 'Salaire Nico',
        dayOfMonth: 28,
        occurrenceDates: [],
      },
    ]);

    expect(incomes).toEqual([
      { key: 'nico', label: 'Salaire Nico', amount: 2500, dayOfMonth: 28, occurrenceDates: [] },
    ]);
  });

  it('ignore les salaires à 0 ou hors des catégories de revenu configurées', () => {
    const incomes = buildDeclaredSalaryIncomes(
      { nico: { categorie: 'Salaire Nico', montant: 0 }, gwen: salaires.gwen },
      ['Salaire Nico'],
      [],
    );

    expect(incomes).toEqual([]);
  });
});
