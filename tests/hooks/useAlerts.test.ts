import { describe, it, expect } from 'vitest';
import { computeAlerts } from '../../public/src/utils/computeAlerts';
import type { Recurrence } from '../../public/src/types/banking.types';

function makeTx(categorie: string, montant: number, mois = '2026-05') {
  return {
    id: Math.random().toString(),
    libelle: 'test',
    montant,
    compte: 'CCP',
    date: `${mois}-15`,
    categorie,
    moisAffectation: mois,
  };
}

const base = { budgets: [], transactions: [], recurrences: [], suggestions: [] };

describe('computeAlerts', () => {
  it('génère une alerte error si le budget est dépassé (mois passé)', () => {
    const budgets = [{ categorie: 'Alimentation', montant: 300, id: '1', actif: true }];
    const transactions = [makeTx('Alimentation', -400, '2026-04')];

    const alerts = computeAlerts({ ...base, budgets, transactions, currentMonthKey: '2026-05' });

    const budgetAlert = alerts.find((a) => a.id.startsWith('budget-over-'));
    expect(budgetAlert).toBeDefined();
    expect(budgetAlert!.type).toBe('error');
  });

  it('génère une alerte warning si le budget est à 80% (mois passé terminé)', () => {
    const budgets = [{ categorie: 'Restaurants', montant: 200, id: '2', actif: true }];
    const transactions = [makeTx('Restaurants', -170, '2026-04')];

    const alerts = computeAlerts({ ...base, budgets, transactions, currentMonthKey: '2026-05' });

    const budgetAlert = alerts.find((a) => a.id.startsWith('budget-watch-'));
    expect(budgetAlert).toBeDefined();
    expect(budgetAlert!.type).toBe('warning');
  });

  it('génère une alerte warning pour une récurrence active en retard', () => {
    const recurrences: Recurrence[] = [
      {
        id: 'netflix',
        label: 'NETFLIX',
        category: 'Loisirs',
        expectedAmount: -15.99,
        dayOfMonth: 15,
        active: true,
      } as Recurrence,
    ];

    // Mois largement dans le passé : l'échéance est toujours en retard.
    const alerts = computeAlerts({ ...base, recurrences, currentMonthKey: '2020-01' });

    const recurringAlert = alerts.find((a) => a.id.startsWith('recurring-overdue-'));
    expect(recurringAlert).toBeDefined();
    expect(recurringAlert!.type).toBe('warning');
    expect(recurringAlert!.actionTab).toBe('recurring');
  });

  it("ne génère pas d'alerte budget si le budget n'est pas dépassé", () => {
    const budgets = [{ categorie: 'Transport', montant: 100, id: '3', actif: true }];
    const transactions = [makeTx('Transport', -50, '2026-04')];

    const alerts = computeAlerts({ ...base, budgets, transactions, currentMonthKey: '2026-05' });

    const budgetAlerts = alerts.filter((a) => a.id.startsWith('budget-'));
    expect(budgetAlerts).toHaveLength(0);
  });

  it("ne génère pas d'alerte pour les budgets inactifs", () => {
    const budgets = [{ categorie: 'Loisirs', montant: 50, id: '4', actif: false }];
    const transactions = [makeTx('Loisirs', -200, '2026-04')];

    const alerts = computeAlerts({ ...base, budgets, transactions, currentMonthKey: '2026-05' });

    expect(alerts.filter((a) => a.id.startsWith('budget-'))).toHaveLength(0);
  });
});
