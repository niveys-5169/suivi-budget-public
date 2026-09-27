import { describe, it, expect } from 'vitest';
import { computeEnvelope, getEcheanceMonth, getEnvelopeCycle, isEnvelope } from '../annualEnvelope';
import type { BudgetBase } from '../../types/banking.types';

const vacances: BudgetBase = {
  id: 'vacances',
  categorie: 'Vacances',
  nom: 'Vacances',
  montant: 3000,
  actif: true,
  type: 'annuel',
  moisAttendus: [7],
};

describe('getEnvelopeCycle', () => {
  it('juillet vu depuis mars : août N-1 → juillet N', () => {
    expect(getEnvelopeCycle(7, '2027-03')).toEqual({ debut: '2026-08', fin: '2027-07' });
  });

  it('juillet vu depuis juillet : cycle en cours jusqu’à juillet', () => {
    expect(getEnvelopeCycle(7, '2027-07')).toEqual({ debut: '2026-08', fin: '2027-07' });
  });

  it('juillet vu depuis août / octobre : cycle de l’été suivant', () => {
    expect(getEnvelopeCycle(7, '2026-08')).toEqual({ debut: '2026-08', fin: '2027-07' });
    expect(getEnvelopeCycle(7, '2026-10')).toEqual({ debut: '2026-08', fin: '2027-07' });
  });

  it('décembre = année civile', () => {
    expect(getEnvelopeCycle(12, '2026-05')).toEqual({ debut: '2026-01', fin: '2026-12' });
  });
});

describe('getEcheanceMonth / isEnvelope', () => {
  it('dernier mois attendu, décembre par défaut', () => {
    expect(getEcheanceMonth({ moisAttendus: [6, 7] })).toBe(7);
    expect(getEcheanceMonth({ moisAttendus: [] })).toBe(12);
    expect(getEcheanceMonth({})).toBe(12);
  });

  it('seuls les budgets annuels de dépense actifs', () => {
    expect(isEnvelope(vacances)).toBe(true);
    expect(isEnvelope({ ...vacances, type: 'mensuel' })).toBe(false);
    expect(isEnvelope({ ...vacances, isIncome: true })).toBe(false);
    expect(isEnvelope({ ...vacances, actif: false })).toBe(false);
  });
});

describe('computeEnvelope', () => {
  it('compte un acompte de mars et les dépenses d’octobre précédent', () => {
    const txs = [
      { categorie: 'Vacances', montant: -300, date: '2026-10-12' },
      { categorie: 'Vacances', montant: -400, date: '2027-03-05' },
      { categorie: 'vacances ', montant: -100, date: '2027-03-20' },
      { categorie: 'Vacances', montant: -999, date: '2026-07-15' }, // cycle précédent
      { categorie: 'Courses', montant: -50, date: '2027-03-05' },
    ];
    const env = computeEnvelope(vacances, txs, '2027-03');
    expect(env.depense).toBe(800);
    expect(env.reste).toBe(2200);
    expect(env.echeanceKey).toBe('2027-07');
    expect(env.provisionMensuelle).toBe(250);
  });

  it('déduit les remboursements et respecte moisAffectation', () => {
    const txs = [
      { categorie: 'Vacances', montant: -1000, date: '2027-07-02' },
      { categorie: 'Vacances', montant: 200, date: '2027-07-20' },
      { categorie: 'Vacances', montant: -500, date: '2027-08-01', moisAffectation: '2027-07' },
    ];
    expect(computeEnvelope(vacances, txs, '2027-07').depense).toBe(1300);
  });

  it('ignore les virements internes', () => {
    const txs = [{ categorie: 'Virement interne', montant: -500, date: '2027-03-01' }];
    expect(computeEnvelope(vacances, txs, '2027-03').depense).toBe(0);
  });
});
