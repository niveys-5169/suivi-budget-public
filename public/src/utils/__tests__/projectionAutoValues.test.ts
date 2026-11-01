import { describe, it, expect } from 'vitest';
import type { Credit, ProjectionClasseCategorie, Transaction } from '../../types/banking.types';
import { defaultCategoryClass } from '../projection/categoryClasses';
import { computeObservedValues } from '../projection/autoValues';

const ctx = {
  revenuCategories: ['Salaire A', 'CAF'],
  creditCategories: ['Prêt immo'],
  excludedCategories: ['Projet Extension'],
};

const tx = (id: string, date: string, montant: number, categorie?: string): Transaction => ({
  id,
  date,
  libelle: `Op ${id}`,
  montant,
  compte: 'Compte test',
  pointe: true,
  categorie,
});

describe('defaultCategoryClass', () => {
  const cls = (c: string) => defaultCategoryClass(c, ctx);

  it('revenu, fixe, exclu selon le contexte', () => {
    expect(cls('Salaire A')).toBe('revenu');
    expect(cls('Prêt immo')).toBe('fixe');
    expect(cls('Projet Extension')).toBe('exclu');
  });

  it('un libellé commençant par Crédit est fixe', () => {
    expect(cls('Crédit voiture')).toBe('fixe');
  });

  it('épargne et retrait épargne : trésorerie (accents ignorés)', () => {
    expect(cls('Épargne')).toBe('tresorerie');
    expect(cls('Retrait épargne')).toBe('tresorerie');
  });

  it('virements internes', () => {
    expect(cls('Virement interne')).toBe('interne');
    expect(cls('Virements internes')).toBe('interne');
  });

  it('remboursements et autres revenus : ponctuel', () => {
    expect(cls('Remboursement santé')).toBe('ponctuel');
    expect(cls('Autres revenus')).toBe('ponctuel');
  });

  it('le reste est une dépense', () => {
    expect(cls('Courses')).toBe('depense');
  });

  it('revenu prime sur ponctuel', () => {
    expect(
      defaultCategoryClass('Autres revenus', { ...ctx, revenuCategories: ['Autres revenus'] }),
    ).toBe('revenu');
  });
});

describe('computeObservedValues', () => {
  const base = { credits: [] as Credit[], classes: {}, ctx, patrimoineHorsPer: null };

  it('sans transaction : tout est vide', () => {
    const obs = computeObservedValues({ ...base, transactions: [] });
    expect(obs.periode).toBeNull();
    expect(obs.budgetReference).toBeNull();
    expect(obs.epargneNetteMensuelle).toBeNull();
    expect(obs.detailCategories).toEqual([]);
  });

  it('fenêtre de 12 mois glissants finissant à la date max', () => {
    const obs = computeObservedValues({
      ...base,
      transactions: [
        tx('a', '2025-03-01', -120, 'Courses'),
        tx('b', '2025-02-28', -9999, 'Courses'),
        tx('c', '2026-02-28', -120, 'Courses'),
        tx('d', 'pas une date', -5000, 'Courses'),
      ],
    });
    expect(obs.periode).toEqual({ debut: '2025-03-01', fin: '2026-02-28' });
    expect(obs.moyenneMensuelleParCategorie['Courses']).toBe(-20);
    expect(obs.budgetReference).toBe(20);
  });

  it('solde net signé : les remboursements viennent en déduction', () => {
    const obs = computeObservedValues({
      ...base,
      transactions: [tx('a', '2026-01-10', -1300, 'Santé'), tx('b', '2026-01-20', 100, 'Santé')],
    });
    const sante = obs.detailCategories.find((d) => d.categorie === 'Santé');
    expect(sante).toEqual({
      categorie: 'Santé',
      classe: 'depense',
      soldeNet: -1200,
      retenuAnnuel: 1200,
    });
    expect(obs.budgetReference).toBe(100);
  });

  it('classe explicite prioritaire ; catégorie vide regroupée', () => {
    const classes: Record<string, ProjectionClasseCategorie> = { Courses: 'ponctuel' };
    const obs = computeObservedValues({
      ...base,
      classes,
      transactions: [tx('a', '2026-01-10', -1200, 'Courses'), tx('b', '2026-01-11', -600)],
    });
    const sans = obs.detailCategories.find((d) => d.categorie === '(sans catégorie)');
    expect(sans?.classe).toBe('depense');
    expect(obs.detailCategories.find((d) => d.categorie === 'Courses')?.retenuAnnuel).toBe(0);
    expect(obs.budgetReference).toBe(50);
  });

  it('les catégories exclues sont retirées du budget', () => {
    const obs = computeObservedValues({
      ...base,
      transactions: [
        tx('a', '2026-01-10', -1200, 'Courses'),
        tx('b', '2026-01-11', -6000, 'Projet Extension'),
        tx('c', '2026-01-12', 3000, 'Salaire A'),
      ],
    });
    const ext = obs.detailCategories.find((d) => d.categorie === 'Projet Extension');
    expect(ext).toMatchObject({ classe: 'exclu', retenuAnnuel: 6000 });
    expect(obs.budgetReference).toBe(100);
  });

  it('transactions annulées ou en attente ignorées ; ventilation répartie', () => {
    const ventilee: Transaction = {
      ...tx('v', '2026-01-10', -1200, 'Courses'),
      ventilation: [{ montant: -600, categorie: 'Loisirs' }],
    };
    const obs = computeObservedValues({
      ...base,
      transactions: [
        ventilee,
        { ...tx('x', '2026-01-11', -999, 'Courses'), bankStatus: 'cancelled' },
        { ...tx('y', '2026-01-11', -999, 'Courses'), enAttente: true },
      ],
    });
    expect(obs.moyenneMensuelleParCategorie['Courses']).toBe(-50);
    expect(obs.moyenneMensuelleParCategorie['Loisirs']).toBe(-50);
  });

  it('épargne nette mensuelle : opposé du solde des catégories trésorerie / 12', () => {
    const obs = computeObservedValues({
      ...base,
      transactions: [
        tx('a', '2026-01-10', -2400, 'Épargne'),
        tx('b', '2026-02-10', 600, 'Retrait épargne'),
      ],
    });
    expect(obs.epargneNetteMensuelle).toBe(150);
    expect(obs.budgetReference).toBe(0);
  });

  it('crédits : mensualité hors assurance, dernier mois, taux', () => {
    const credit: Credit = {
      id: 'c1',
      nom: 'Prêt test',
      capitalInitial: 12000,
      tauxAnnuel: 0,
      dureeMois: 24,
      dateDebut: '2026-01-15',
      assuranceMensuelle: 15,
    };
    const obs = computeObservedValues({
      ...base,
      credits: [credit],
      patrimoineHorsPer: 1000,
      transactions: [tx('a', '2026-01-10', -10, 'Courses')],
    });
    expect(obs.credits['c1']).toEqual({
      libelle: 'Prêt test',
      mensualite: 500,
      fin: '2027-12',
      tauxAnnuel: 0,
    });
    expect(obs.patrimoineHorsPer).toBe(1000);
  });
});
