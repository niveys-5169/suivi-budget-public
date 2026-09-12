import { describe, it, expect } from 'vitest';
import { computeDashboardStats } from '../../public/src/hooks/useDashboardStats';
import { resolveDashboardRange } from '../../public/src/hooks/useDashboardFiltered';

describe('computeDashboardStats', () => {
  it('sépare dépenses (négatif) et recettes (positif)', () => {
    const txs = [
      { id: '1', date: '2026-06-01', montant: -30 },
      { id: '2', date: '2026-06-02', montant: 100 },
      { id: '3', date: '2026-06-03', montant: -20 },
    ] as any;
    expect(computeDashboardStats(txs)).toEqual({ totalDep: -50, totalRec: 100, solde: 50 });
  });

  it('ignore les montants nuls et non numériques', () => {
    const txs = [
      { id: '1', date: '2026-06-01', montant: 0 },
      { id: '2', date: '2026-06-02', montant: undefined },
      { id: '3', date: '2026-06-03', montant: 42 },
    ] as any;
    expect(computeDashboardStats(txs)).toEqual({ totalDep: 0, totalRec: 42, solde: 42 });
  });

  it('renvoie un solde nul pour une liste vide', () => {
    expect(computeDashboardStats([])).toEqual({ totalDep: 0, totalRec: 0, solde: 0 });
  });
});

describe('resolveDashboardRange', () => {
  const now = new Date('2026-06-13T12:00:00Z');

  it('year_to_date : du 1er janvier à aujourd’hui', () => {
    expect(resolveDashboardRange('year_to_date', { start: '', end: '' }, now)).toEqual({
      start: '2026-01-01',
      end: '2026-06-13',
    });
  });

  it('last_year : année civile précédente complète', () => {
    expect(resolveDashboardRange('last_year', { start: '', end: '' }, now)).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    });
  });

  it('custom : reprend les bornes fournies', () => {
    expect(
      resolveDashboardRange('custom', { start: '2026-03-01', end: '2026-03-31' }, now),
    ).toEqual({ start: '2026-03-01', end: '2026-03-31' });
  });

  it('current_month / all_time : bornes vides (filtrage hors plage de dates)', () => {
    expect(resolveDashboardRange('current_month', { start: '', end: '' }, now)).toEqual({
      start: '',
      end: '',
    });
    expect(resolveDashboardRange('all_time', { start: '', end: '' }, now)).toEqual({
      start: '',
      end: '',
    });
  });
});
