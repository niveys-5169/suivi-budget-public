import { describe, expect, it } from 'vitest';
import { findGapSuspects } from '../../public/src/utils/monthlySavingsGapSuspects';
import type { Transaction } from '../../public/src/types/banking.types';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx',
  date: '2026-09-15',
  libelle: 'Opération',
  montant: -10,
  compte: 'Compte courant',
  pointe: true,
  ...overrides,
});

const find = (transactions: Transaction[], gap = -133.42) =>
  findGapSuspects({ month: '2026-09', accountName: 'Compte courant', gap, transactions });

describe('findGapSuspects', () => {
  it("ne cherche rien quand le compte n'a pas d'écart", () => {
    expect(find([tx({ moisAffectation: '2026-10' })], 0)).toEqual([]);
  });

  it('signale une opération du mois affectée à un autre mois', () => {
    const [suspect] = find([tx({ id: 'a', moisAffectation: '2026-10' })]);
    expect(suspect).toMatchObject({ transactionId: 'a', reasons: ['ASSIGNED_ELSEWHERE'] });
  });

  it("signale une opération d'un autre mois affectée à ce mois", () => {
    const [suspect] = find([tx({ id: 'b', date: '2026-08-31', moisAffectation: '2026-09' })]);
    expect(suspect?.reasons).toEqual(['ASSIGNED_HERE']);
  });

  it('signale les opérations en attente et celles datées sur les bornes', () => {
    const suspects = find([
      tx({ id: 'p', enAttente: true }),
      tx({ id: 'first', date: '2026-09-01' }),
      tx({ id: 'next', date: '2026-10-01' }),
      tx({ id: 'plain' }),
    ]);
    expect(suspects.map((s) => [s.transactionId, s.reasons])).toEqual(
      expect.arrayContaining([
        ['p', ['PENDING']],
        ['first', ['BOUNDARY_DATE']],
        ['next', ['BOUNDARY_DATE']],
      ]),
    );
    expect(suspects.find((s) => s.transactionId === 'plain')).toBeUndefined();
  });

  it("signale un montant égal à l'écart et le classe en premier", () => {
    const suspects = find([
      tx({ id: 'first', date: '2026-09-01' }),
      tx({ id: 'same', montant: 133.42 }),
    ]);
    expect(suspects[0]).toMatchObject({ transactionId: 'same', reasons: ['MATCHES_GAP'] });
  });

  it('ignore les opérations des autres comptes', () => {
    expect(find([tx({ compte: 'Livret A', moisAffectation: '2026-10' })])).toEqual([]);
  });
});
