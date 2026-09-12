import { describe, it, expect } from 'vitest';
import {
  transactionFormSchema,
  placementFormSchema,
  budgetFormSchema,
  ravConfigSchema,
} from '../../../public/src/lib/schemas/forms';

describe('transactionFormSchema', () => {
  const baseValid = {
    date: '2026-05-15',
    compte: 'Compte Courant',
    libelle: 'Courses',
    montant: -45.5,
    categorie: 'Alimentation',
    moisAffectation: '2026-05',
    pointe: false,
    commentaire: '',
  };

  it('accepts a valid transaction', () => {
    const result = transactionFormSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it('accepts empty moisAffectation', () => {
    const result = transactionFormSchema.safeParse({ ...baseValid, moisAffectation: '' });
    expect(result.success).toBe(true);
  });

  it('rejects empty libelle', () => {
    const result = transactionFormSchema.safeParse({ ...baseValid, libelle: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe('Libellé requis');
    }
  });

  it('rejects invalid date format', () => {
    const result = transactionFormSchema.safeParse({ ...baseValid, date: '15/05/2026' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid moisAffectation format', () => {
    const result = transactionFormSchema.safeParse({ ...baseValid, moisAffectation: '2026/05' });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric montant', () => {
    const result = transactionFormSchema.safeParse({ ...baseValid, montant: NaN });
    expect(result.success).toBe(false);
  });

  it('rejects missing compte', () => {
    const result = transactionFormSchema.safeParse({ ...baseValid, compte: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe('Compte requis');
    }
  });
});

describe('placementFormSchema', () => {
  const baseValid = {
    nom: 'Livret A',
    owner: 'Nicolas',
    type: 'savings' as const,
    montant: 5000,
    compte: '',
  };

  it('accepts a valid placement', () => {
    const result = placementFormSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it('rejects unknown type', () => {
    const result = placementFormSchema.safeParse({ ...baseValid, type: 'crypto' });
    expect(result.success).toBe(false);
  });

  it('rejects empty nom', () => {
    const result = placementFormSchema.safeParse({ ...baseValid, nom: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe("Nom de l'actif requis");
    }
  });

  it('accepts negative montant (loss)', () => {
    const result = placementFormSchema.safeParse({ ...baseValid, montant: -100 });
    expect(result.success).toBe(true);
  });

  it('rejects Infinity', () => {
    const result = placementFormSchema.safeParse({ ...baseValid, montant: Infinity });
    expect(result.success).toBe(false);
  });
});

describe('budgetFormSchema', () => {
  const baseValid = {
    nom: 'Vacances',
    categorie: 'Loisirs',
    type: 'mensuel' as const,
    montant: 200,
    actif: true,
    sens: 'auto' as const,
    moisAttendus: [],
    compte: null,
    periode: { type: 'mois_courant' as const },
  };

  it('accepts a valid mensuel budget', () => {
    const result = budgetFormSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it('rejects negative montant', () => {
    const result = budgetFormSchema.safeParse({ ...baseValid, montant: -10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe('Le montant doit être ≥ 0');
    }
  });

  it('accepts annuel with moisAttendus', () => {
    const result = budgetFormSchema.safeParse({
      ...baseValid,
      type: 'annuel',
      moisAttendus: [1, 6, 12],
      periode: { type: 'annee_civile' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects ponctuel without periode dates', () => {
    const result = budgetFormSchema.safeParse({
      ...baseValid,
      type: 'ponctuel',
      periode: { type: 'custom' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Date de début requise');
      expect(messages).toContain('Date de fin requise');
    }
  });

  it('accepts ponctuel with both periode dates', () => {
    const result = budgetFormSchema.safeParse({
      ...baseValid,
      type: 'ponctuel',
      periode: { type: 'custom', debut: '2026-01-01', fin: '2026-12-31' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects month outside [1,12]', () => {
    const result = budgetFormSchema.safeParse({
      ...baseValid,
      type: 'annuel',
      moisAttendus: [13],
      periode: { type: 'annee_civile' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts compte as string or null', () => {
    expect(budgetFormSchema.safeParse({ ...baseValid, compte: 'Carte Visa' }).success).toBe(true);
    expect(budgetFormSchema.safeParse({ ...baseValid, compte: null }).success).toBe(true);
  });
});

describe('ravConfigSchema', () => {
  const baseValid = {
    revenu_mensuel_net: null,
    provision_salaires: {
      nico: { montant: 2500, categorie: 'Salaire Nico' },
    },
    revenu_categories: ['Salaire', 'Freelance'],
    depense_categories: ['Courses', 'Loyer'],
    included_accounts: ['compte-courant'],
  };

  it('accepts a valid config', () => {
    expect(ravConfigSchema.safeParse(baseValid).success).toBe(true);
  });

  it('accepts empty provisions and empty arrays', () => {
    expect(
      ravConfigSchema.safeParse({
        revenu_mensuel_net: null,
        provision_salaires: {},
        revenu_categories: [],
        depense_categories: [],
        included_accounts: [],
      }).success,
    ).toBe(true);
  });

  it('rejects negative salary provision', () => {
    expect(
      ravConfigSchema.safeParse({
        ...baseValid,
        provision_salaires: { nico: { montant: -100, categorie: 'Salaire Nico' } },
      }).success,
    ).toBe(false);
  });

  it('rejects NaN salary provision', () => {
    expect(
      ravConfigSchema.safeParse({
        ...baseValid,
        provision_salaires: { nico: { montant: Number.NaN, categorie: 'Salaire Nico' } },
      }).success,
    ).toBe(false);
  });

  it('accepts revenu_mensuel_net as number (legacy migration)', () => {
    expect(ravConfigSchema.safeParse({ ...baseValid, revenu_mensuel_net: 3000 }).success).toBe(
      true,
    );
  });

  it('rejects non-string elements in category arrays', () => {
    expect(ravConfigSchema.safeParse({ ...baseValid, revenu_categories: ['ok', 42] }).success).toBe(
      false,
    );
  });
});
