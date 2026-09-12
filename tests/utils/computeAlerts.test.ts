import { describe, it, expect } from 'vitest';
import { computeAlerts } from '../../public/src/utils/computeAlerts';
import type { Recurrence } from '../../public/src/types/banking.types';

const currentMonthKey = '2024-06';
const prevMonthKey = '2024-05';

const mkTx = (categorie: string, montant: number, moisAffectation = prevMonthKey) => ({
  categorie,
  montant,
  moisAffectation,
});

const mkBudget = (id: string, categorie: string, montant: number, actif = true) => ({
  id,
  categorie,
  montant,
  actif,
});

const mkRecurrence = (over: Partial<Recurrence>): Recurrence =>
  ({
    id: 'r1',
    label: 'Netflix',
    category: 'Abonnements',
    expectedAmount: -15.99,
    dayOfMonth: 15,
    active: true,
    ...over,
  }) as Recurrence;

const base = { budgets: [], transactions: [], recurrences: [] };

describe('computeAlerts', () => {
  it('generates an error alert when budget is exceeded (ratio >= 1)', () => {
    const alerts = computeAlerts({
      ...base,
      budgets: [mkBudget('courses', 'Courses', 200)],
      transactions: [mkTx('Courses', -250)],
      currentMonthKey,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe('error');
    expect(alerts[0]!.title).toBe('Budget dépassé');
    expect(alerts[0]!.id).toBe('budget-over-courses');
  });

  it('generates a warning alert when budget is 80–99% consumed', () => {
    const alerts = computeAlerts({
      ...base,
      budgets: [mkBudget('loisirs', 'Loisirs', 100)],
      transactions: [mkTx('Loisirs', -85)],
      currentMonthKey,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe('warning');
    expect(alerts[0]!.title).toBe('Attention budget');
  });

  it('generates no budget alert when ratio < 0.8', () => {
    const alerts = computeAlerts({
      ...base,
      budgets: [mkBudget('restau', 'Restau', 200)],
      transactions: [mkTx('Restau', -100)],
      currentMonthKey,
    });
    expect(alerts).toHaveLength(0);
  });

  it('skips budgets with actif === false', () => {
    const alerts = computeAlerts({
      ...base,
      budgets: [mkBudget('vacances', 'Vacances', 100, false)],
      transactions: [mkTx('Vacances', -200)],
      currentMonthKey,
    });
    expect(alerts).toHaveLength(0);
  });

  it('only considers transactions from the previous month for budget alerts', () => {
    const alerts = computeAlerts({
      ...base,
      budgets: [mkBudget('courses', 'Courses', 100)],
      transactions: [mkTx('Courses', -200, currentMonthKey)],
      currentMonthKey,
    });
    expect(alerts).toHaveLength(0);
  });

  it('generates a warning alert for an overdue active recurrence', () => {
    const alerts = computeAlerts({
      ...base,
      recurrences: [mkRecurrence({ dayOfMonth: 1 })],
      currentMonthKey: '2020-01', // largement dans le passé → toujours en retard
    });
    const recurringAlert = alerts.find((a) => a.id.startsWith('recurring-overdue-'));
    expect(recurringAlert).toBeDefined();
    expect(recurringAlert!.type).toBe('warning');
    expect(recurringAlert!.actionTab).toBe('recurring');
  });

  it('does not flag an inactive recurrence as overdue', () => {
    const alerts = computeAlerts({
      ...base,
      recurrences: [mkRecurrence({ dayOfMonth: 1, active: false })],
      currentMonthKey: '2020-01',
    });
    expect(alerts.filter((a) => a.id.startsWith('recurring-'))).toHaveLength(0);
  });

  it('generates a price-increase alert when an auto-matched transaction exceeds the expected amount by >10%', () => {
    const alerts = computeAlerts({
      ...base,
      recurrences: [mkRecurrence({ expectedAmount: -10, dayOfMonth: 15, category: 'Abonnements' })],
      transactions: [
        {
          id: 'tx1',
          libelle: 'Netflix',
          categorie: 'Abonnements',
          montant: -11.5, // +15% : dans la tolérance de matching (±20%) et > seuil d'alerte (10%)
          date: '2024-06-15',
          moisAffectation: currentMonthKey,
        },
      ],
      currentMonthKey,
    });
    const priceAlert = alerts.find((a) => a.id.startsWith('recurring-price-'));
    expect(priceAlert).toBeDefined();
    expect(priceAlert!.type).toBe('info');
  });

  it('handles empty inputs gracefully', () => {
    expect(computeAlerts({ ...base, currentMonthKey })).toEqual([]);
  });
});
