import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWealthAggregates } from '../../public/src/hooks/useWealthAggregates';

const placements = [
  { id: 'p1', nom: 'Livret perso', owner: 'Nicolas', type: 'savings', montant: 10000 },
  { id: 'p2', nom: 'Maison', owner: 'Nicolas', type: 'immobilier', montant: 300000 },
  { id: 'p3', nom: 'Studio', owner: 'Romane', type: 'immobilier', montant: 100000 },
];

vi.mock('../../public/src/hooks/usePatrimoine', () => ({
  usePatrimoine: () => ({
    placements,
    savingsBalances: [],
    accountBalances: [],
    ownerMapping: { owners: [], accounts: {}, savings_patterns: {}, default_owner: 'Nicolas' },
  }),
}));

const amountOf = (segments: { type: string; amount: number }[], type: string) =>
  segments.find((s) => s.type === type)?.amount;

describe('useWealthAggregates — immobilier', () => {
  it('range les biens dans leur propre segment, plus dans les investissements', () => {
    const { result } = renderHook(() => useWealthAggregates('all', 0, []));
    const { segments, total } = result.current;

    expect(segments.map((s) => s.type)).toEqual([
      'cash',
      'savings',
      'investissements',
      'retirement',
      'immobilier',
    ]);
    expect(amountOf(segments, 'immobilier')).toBe(400000);
    expect(amountOf(segments, 'investissements')).toBe(0);
    expect(amountOf(segments, 'savings')).toBe(10000);
    expect(total).toBe(410000);
    expect(segments.find((s) => s.type === 'immobilier')?.pct).toBeCloseTo((400000 / 410000) * 100);
  });

  it('respecte le filtre propriétaire', () => {
    const { result } = renderHook(() => useWealthAggregates(['Romane'], 0, []));
    expect(amountOf(result.current.segments, 'immobilier')).toBe(100000);
    expect(result.current.total).toBe(100000);
  });

  it('respecte le filtre de type, sans l’appliquer à l’ancre « tous types »', () => {
    const { result } = renderHook(() => useWealthAggregates('all', 0, [], ['immobilier']));
    expect(result.current.total).toBe(400000);
    expect(amountOf(result.current.segmentsAllTypes, 'savings')).toBe(10000);
    expect(amountOf(result.current.segmentsAllTypes, 'immobilier')).toBe(400000);
  });
});
