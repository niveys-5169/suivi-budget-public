import { describe, it, expect } from 'vitest';
import { Transaction } from '../../types/banking.types';
import { isRechargeDomicile, buildEdfCredit } from '../transactionRepository';

const recharge: Transaction = {
  id: '2026-04-06_recharge_domicile_ev_n1050',
  date: '2026-04-06',
  libelle: 'Recharge domicile EV',
  montant: -10.5,
  compte: 'Voiture',
  pointe: true,
  categorie: 'Recharge domicile',
  source: 'tronity',
  edfCompte: 'EDF',
};

describe('isRechargeDomicile', () => {
  it('reconnaît une recharge Tronity avec compte EDF cible', () => {
    expect(isRechargeDomicile(recharge)).toBe(true);
  });

  it('rejette une transaction sans compte EDF cible', () => {
    expect(isRechargeDomicile({ ...recharge, edfCompte: undefined })).toBe(false);
  });

  it('rejette une transaction d’une autre source ou catégorie', () => {
    expect(isRechargeDomicile({ ...recharge, source: 'manuel' })).toBe(false);
    expect(isRechargeDomicile({ ...recharge, categorie: 'Voiture' })).toBe(false);
  });
});

describe('buildEdfCredit', () => {
  const credit = buildEdfCredit(recharge);

  it('inverse le montant (déduction EDF positive)', () => {
    expect(credit.montant).toBe(10.5);
  });

  it('cible le compte EDF porté par la recharge', () => {
    expect(credit.compte).toBe('EDF');
  });

  it('lie le crédit à sa recharge et le marque pointé', () => {
    expect(credit.rechargeId).toBe(recharge.id);
    expect(credit.pointe).toBe(true);
  });
});
