import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBudgetProjection } from '../../public/src/hooks/useBudgetProjection';

vi.mock('../../public/src/hooks/useTransactions', () => ({
  useTransactions: vi.fn(),
}));

vi.mock('../../public/src/hooks/useBudget', () => ({
  useBudget: vi.fn(),
}));

import { useTransactions } from '../../public/src/hooks/useTransactions';
import { useBudget } from '../../public/src/hooks/useBudget';

const mockUseTransactions = useTransactions as ReturnType<typeof vi.fn>;
const mockUseBudget = useBudget as ReturnType<typeof vi.fn>;

function makeTx(categorie: string, montant: number, mois: string) {
  return {
    id: Math.random().toString(),
    libelle: 'test',
    montant,
    compte: 'CCP',
    categorie,
    moisAffectation: mois,
    date: `${mois}-01`,
  };
}

describe('useBudgetProjection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBudget.mockReturnValue({ budgets: [] });
  });

  it('retourne status ok quand les dépenses sont sous 80% du budget', () => {
    mockUseTransactions.mockReturnValue({
      transactions: [makeTx('Alimentation', -100, '2026-05')],
    });
    mockUseBudget.mockReturnValue({
      budgets: [{ categorie: 'Alimentation', montant: 500 }],
    });

    const { result } = renderHook(() => useBudgetProjection('Alimentation', 'month', '2026-05'));

    expect(result.current.status).toBe('ok');
    expect(result.current.spentToDate).toBe(100);
  });

  it('retourne status watch quand les dépenses dépassent 80% du budget (mois passé terminé)', () => {
    // Sur un mois passé, elapsedDays === totalDays, donc projection === réel
    // 420 / 500 = 84% → watch (>= 80% mais <= 100%)
    mockUseTransactions.mockReturnValue({
      transactions: [makeTx('Alimentation', -420, '2026-04')],
    });
    mockUseBudget.mockReturnValue({
      budgets: [{ categorie: 'Alimentation', montant: 500 }],
    });

    const { result } = renderHook(() => useBudgetProjection('Alimentation', 'month', '2026-04'));

    expect(result.current.status).toBe('watch');
  });

  it('retourne status risk quand les dépenses dépassent 100% du budget', () => {
    mockUseTransactions.mockReturnValue({
      transactions: [makeTx('Alimentation', -600, '2026-05')],
    });
    mockUseBudget.mockReturnValue({
      budgets: [{ categorie: 'Alimentation', montant: 500 }],
    });

    const { result } = renderHook(() => useBudgetProjection('Alimentation', 'month', '2026-05'));

    expect(result.current.status).toBe('risk');
  });

  it('ignore les transactions des autres catégories', () => {
    mockUseTransactions.mockReturnValue({
      transactions: [makeTx('Alimentation', -100, '2026-05'), makeTx('Transport', -900, '2026-05')],
    });
    mockUseBudget.mockReturnValue({
      budgets: [{ categorie: 'Alimentation', montant: 500 }],
    });

    const { result } = renderHook(() => useBudgetProjection('Alimentation', 'month', '2026-05'));

    expect(result.current.spentToDate).toBe(100);
    expect(result.current.status).toBe('ok');
  });

  it('retourne limit 0 et status ok quand aucun budget défini', () => {
    mockUseTransactions.mockReturnValue({ transactions: [] });
    mockUseBudget.mockReturnValue({ budgets: [] });

    const { result } = renderHook(() => useBudgetProjection('Inconnu', 'month', '2026-05'));

    expect(result.current.limit).toBe(0);
    expect(result.current.status).toBe('ok');
  });

  it('utilise tel quel le budget annuel résolu comme limite en mode annuel', () => {
    // En mode annuel, useBudget() renvoie déjà des montants résolus (annuels) :
    // le hook ne doit PAS re-multiplier par 12.
    mockUseTransactions.mockReturnValue({
      transactions: [makeTx('Alimentation', -200, '2026-05')],
    });
    mockUseBudget.mockReturnValue({
      budgets: [{ categorie: 'Alimentation', montant: 6000 }],
    });

    const { result } = renderHook(() => useBudgetProjection('Alimentation', 'year', '2026-05'));

    expect(result.current.limit).toBe(6000);
  });

  it('agrège les dépenses de toute l’année et projette correctement (année passée)', () => {
    // Année révolue → elapsedDays === totalDays, donc projection === réel (déterministe).
    mockUseTransactions.mockReturnValue({
      transactions: [
        makeTx('Alimentation', -3000, '2025-03'),
        makeTx('Alimentation', -3300, '2025-09'),
        makeTx('Transport', -5000, '2025-06'),
      ],
    });
    mockUseBudget.mockReturnValue({
      budgets: [{ categorie: 'Alimentation', montant: 6000 }],
    });

    const { result } = renderHook(() => useBudgetProjection('Alimentation', 'year', '2025-05'));

    expect(result.current.spentToDate).toBe(6300);
    expect(result.current.limit).toBe(6000);
    expect(result.current.projectedEndAmount).toBe(6300);
    expect(result.current.varianceProjected).toBe(300);
    expect(result.current.status).toBe('risk');
  });
});
