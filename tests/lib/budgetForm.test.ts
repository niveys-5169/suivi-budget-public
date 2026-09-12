import { describe, it, expect } from 'vitest';
import { deleteField } from 'firebase/firestore';
import {
  periodeTypeFor,
  buildBudgetDefaults,
  buildBudgetPayload,
} from '../../public/src/lib/budgetForm';
import { budgetFormSchema } from '../../public/src/lib/schemas/forms';
import type { BudgetBase } from '../../public/src/types/banking.types';

describe('periodeTypeFor', () => {
  it('derives the periode type from the budget type', () => {
    expect(periodeTypeFor('mensuel')).toBe('mois_courant');
    expect(periodeTypeFor('annuel')).toBe('annee_civile');
    expect(periodeTypeFor('ponctuel')).toBe('custom');
  });
});

describe('buildBudgetDefaults', () => {
  it('returns blank monthly defaults without a budget', () => {
    const d = buildBudgetDefaults();
    expect(d).toMatchObject({
      nom: '',
      categorie: '',
      type: 'mensuel',
      montant: 0,
      actif: true,
      sens: 'auto',
      moisAttendus: [],
      compte: null,
      periode: { type: 'mois_courant', debut: '', fin: '' },
    });
  });

  it('maps an existing budget, including isIncome → sens and periode', () => {
    const budget = {
      id: 'b1',
      nom: 'Courses',
      categorie: 'Alimentation',
      type: 'annuel',
      montant: 1200,
      actif: true,
      isIncome: false,
      moisAttendus: [1, 6],
      compte: 'LCL',
      periode: { type: 'annee_civile', debut: '', fin: '' },
    } as unknown as BudgetBase;
    const d = buildBudgetDefaults(budget);
    expect(d.sens).toBe('sortie');
    expect(d.moisAttendus).toEqual([1, 6]);
    expect(d.compte).toBe('LCL');
    expect(d.periode.type).toBe('annee_civile');
  });

  it('maps isIncome true → entree and undefined → auto', () => {
    expect(buildBudgetDefaults({ isIncome: true } as BudgetBase).sens).toBe('entree');
    expect(buildBudgetDefaults({} as BudgetBase).sens).toBe('auto');
  });

  it('produces values accepted by budgetFormSchema once nom/categorie are set', () => {
    const values = { ...buildBudgetDefaults(), nom: 'Courses', categorie: 'Alimentation' };
    expect(budgetFormSchema.safeParse(values).success).toBe(true);
  });
});

describe('buildBudgetPayload', () => {
  const base = {
    ...buildBudgetDefaults(),
    nom: 'Courses',
    categorie: 'Alimentation',
    montant: 400,
  };

  it('maps sens entree/sortie to isIncome true/false', () => {
    expect(buildBudgetPayload({ ...base, sens: 'entree' }).isIncome).toBe(true);
    expect(buildBudgetPayload({ ...base, sens: 'sortie' }).isIncome).toBe(false);
  });

  it('maps sens auto to a deleteField sentinel and drops the sens key', () => {
    const payload = buildBudgetPayload({ ...base, sens: 'auto' });
    expect(payload.isIncome).toEqual(deleteField());
    expect('sens' in payload).toBe(false);
  });

  it('passes the remaining validated fields through unchanged', () => {
    const payload = buildBudgetPayload({ ...base, sens: 'sortie' });
    expect(payload).toMatchObject({
      nom: 'Courses',
      categorie: 'Alimentation',
      type: 'mensuel',
      montant: 400,
      actif: true,
      moisAttendus: [],
      compte: null,
      periode: { type: 'mois_courant', debut: '', fin: '' },
    });
  });
});

describe('budgetFormSchema — règles partagées desktop/mobile', () => {
  it('rejects a negative amount', () => {
    const values = { ...buildBudgetDefaults(), nom: 'X', categorie: 'X', montant: -5 };
    expect(budgetFormSchema.safeParse(values).success).toBe(false);
  });

  it('requires dates for a one-off (ponctuel) budget', () => {
    const values = {
      ...buildBudgetDefaults(),
      nom: 'X',
      categorie: 'X',
      type: 'ponctuel' as const,
      periode: { type: 'custom' as const, debut: '', fin: '' },
    };
    const res = budgetFormSchema.safeParse(values);
    expect(res.success).toBe(false);
  });
});
