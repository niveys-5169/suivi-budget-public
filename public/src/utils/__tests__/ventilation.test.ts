import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../types/banking.types';
import { expandVentilations, toVentilationParts, ventilationRemainder } from '../ventilation';

const solde: Transaction = {
  id: 'tx1',
  date: '2026-10-28',
  libelle: 'VIR SOLDE DE TOUT COMPTE',
  montant: 12000,
  compte: 'LCL',
  pointe: false,
  categorie: 'Indemnités de licenciement',
  ventilation: [{ montant: 2450, categorie: 'Salaire', moisAffectation: '2026-10' }],
};

describe('ventilationRemainder', () => {
  it('retire les parts du montant, arrondi au centime', () => {
    expect(ventilationRemainder(100.1, [{ montant: 33.37, categorie: 'A' }])).toBe(66.73);
  });
});

describe('expandVentilations', () => {
  it('laisse intacte une transaction sans ventilation', () => {
    const tx: Transaction = { ...solde, ventilation: undefined };
    expect(expandVentilations([tx])).toEqual([tx]);
  });

  it('remplace la transaction par le reste et ses parts, de même total', () => {
    const lines = expandVentilations([solde]);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      id: 'tx1',
      montant: 9550,
      categorie: 'Indemnités de licenciement',
      ventilationParent: solde,
    });
    expect(lines[1]).toMatchObject({
      id: 'tx1#v1',
      montant: 2450,
      categorie: 'Salaire',
      moisAffectation: '2026-10',
      compte: 'LCL',
      date: '2026-10-28',
      ventilationParent: solde,
    });
    expect(lines.reduce((sum, t) => sum + t.montant, 0)).toBe(solde.montant);
  });

  it('donne à une part sans mois celui de la transaction', () => {
    const tx: Transaction = {
      ...solde,
      moisAffectation: '2026-11',
      ventilation: [{ montant: 100, categorie: 'Salaire' }],
    };
    expect(expandVentilations([tx])[1]?.moisAffectation).toBe('2026-11');
  });

  it('omet le reste quand les parts couvrent tout le montant', () => {
    const tx: Transaction = {
      ...solde,
      ventilation: [
        { montant: 2450, categorie: 'Salaire' },
        { montant: 9550, categorie: 'Épargne' },
      ],
    };
    expect(expandVentilations([tx]).map((t) => t.id)).toEqual(['tx1#v1', 'tx1#v2']);
  });

  it('traite une ventilation vide comme absente', () => {
    const tx: Transaction = { ...solde, ventilation: [] };
    expect(expandVentilations([tx])).toEqual([tx]);
  });
});

describe('toVentilationParts', () => {
  it('signe les parts comme la transaction et omet un mois vide', () => {
    expect(
      toVentilationParts(-80, [
        { montant: 30, categorie: 'Courses', moisAffectation: '' },
        { montant: 50, categorie: 'Maison', moisAffectation: '2026-11' },
      ]),
    ).toEqual([
      { montant: -30, categorie: 'Courses' },
      { montant: -50, categorie: 'Maison', moisAffectation: '2026-11' },
    ]);
  });
});
