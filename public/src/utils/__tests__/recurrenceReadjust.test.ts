import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { applyAmountChange, computePeriodState, getAmountForPeriod } from '../recurrenceEngine';
import type { Recurrence, Transaction } from '../../types/banking.types';

const makeRec = (over: Partial<Recurrence> = {}): Recurrence => ({
  id: 'rec-1',
  label: 'Assurance auto',
  category: 'Assurance',
  expectedAmount: -40,
  active: true,
  createdAt: Timestamp.now(),
  anchorDate: '2026-01-05',
  ...over,
});

describe('getAmountForPeriod', () => {
  it('sans historique → montant courant', () => {
    expect(getAmountForPeriod(makeRec(), '2026-03')).toBe(-40);
  });

  it('applique le montant antérieur avant la bascule, le courant à partir de celle-ci', () => {
    const rec = makeRec({
      expectedAmount: -45,
      amountHistory: [{ until: '2026-10', amount: -40 }],
    });
    expect(getAmountForPeriod(rec, '2026-09')).toBe(-40);
    expect(getAmountForPeriod(rec, '2026-10')).toBe(-45);
    expect(getAmountForPeriod(rec, '2027-01')).toBe(-45);
  });

  it('gère plusieurs paliers', () => {
    const rec = makeRec({
      expectedAmount: -50,
      amountHistory: [
        { until: '2026-04', amount: -40 },
        { until: '2026-10', amount: -45 },
      ],
    });
    expect(getAmountForPeriod(rec, '2026-03')).toBe(-40);
    expect(getAmountForPeriod(rec, '2026-04')).toBe(-45);
    expect(getAmountForPeriod(rec, '2026-09')).toBe(-45);
    expect(getAmountForPeriod(rec, '2026-10')).toBe(-50);
  });
});

describe('applyAmountChange', () => {
  it('première hausse : archive l’ancien montant jusqu’au mois choisi', () => {
    expect(applyAmountChange(makeRec(), '2026-10', -45)).toEqual({
      expectedAmount: -45,
      amountHistory: [{ until: '2026-10', amount: -40 }],
    });
  });

  it('nouvelle hausse postérieure : ajoute un palier', () => {
    const rec = makeRec({
      expectedAmount: -45,
      amountHistory: [{ until: '2026-10', amount: -40 }],
    });
    expect(applyAmountChange(rec, '2027-01', -50)).toEqual({
      expectedAmount: -50,
      amountHistory: [
        { until: '2026-10', amount: -40 },
        { until: '2027-01', amount: -45 },
      ],
    });
  });

  it('correction rétroactive : tronque le palier couvrant le mois choisi', () => {
    const rec = makeRec({
      expectedAmount: -50,
      amountHistory: [
        { until: '2026-04', amount: -40 },
        { until: '2026-10', amount: -45 },
      ],
    });
    const result = applyAmountChange(rec, '2026-07', -48);
    expect(result).toEqual({
      expectedAmount: -48,
      amountHistory: [
        { until: '2026-04', amount: -40 },
        { until: '2026-07', amount: -45 },
      ],
    });
    expect(getAmountForPeriod({ ...rec, ...result }, '2026-06')).toBe(-45);
    expect(getAmountForPeriod({ ...rec, ...result }, '2026-07')).toBe(-48);
  });

  it('même mois que la bascule existante : remplace sans dupliquer', () => {
    const rec = makeRec({
      expectedAmount: -45,
      amountHistory: [{ until: '2026-10', amount: -40 }],
    });
    expect(applyAmountChange(rec, '2026-10', -47)).toEqual({
      expectedAmount: -47,
      amountHistory: [{ until: '2026-10', amount: -40 }],
    });
  });

  it('mois antérieur au premier palier : supprime les paliers devenus caducs', () => {
    const rec = makeRec({
      expectedAmount: -45,
      amountHistory: [{ until: '2026-10', amount: -40 }],
    });
    expect(applyAmountChange(rec, '2026-02', -42)).toEqual({
      expectedAmount: -42,
      amountHistory: [{ until: '2026-02', amount: -40 }],
    });
  });
});

describe('computePeriodState avec historique de montants', () => {
  const today = new Date('2026-10-07');
  const rec = makeRec({ expectedAmount: -45, amountHistory: [{ until: '2026-10', amount: -40 }] });

  it('un mois passé reste attendu à l’ancien montant', () => {
    const state = computePeriodState(rec, '2026-09', [], today);
    expect(state.effectiveAmount).toBe(-40);
  });

  it('le mois de bascule utilise le nouveau montant', () => {
    expect(computePeriodState(rec, '2026-10', [], today).effectiveAmount).toBe(-45);
  });

  it('le matching suit le montant de la période (tolérance ±20 %)', () => {
    // -40 est à 33 % de -60 (hors tolérance) mais exact pour septembre.
    const bigJump = makeRec({
      expectedAmount: -60,
      amountHistory: [{ until: '2026-10', amount: -40 }],
    });
    const tx = {
      id: 'tx-sep',
      date: '2026-09-05',
      libelle: 'ASSURANCE',
      categorie: 'Assurance',
      montant: -40,
    } as Transaction;
    expect(computePeriodState(bigJump, '2026-09', [tx], today).state).toBe('matched');
  });
});
