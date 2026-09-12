import { describe, it, expect } from 'vitest';
import {
  getPeriodKey,
  getExpectedDate,
  matchTransaction,
  computePeriodState,
  getUpcomingOccurrences,
  getApprovedTxIds,
  getLinkCandidates,
  getRecurrenceCandidates,
  isSettled,
  needsAction,
} from '../../public/src/utils/recurrenceEngine';
import type { Recurrence, Transaction } from '../../public/src/types/banking.types';

const rec = (over: Partial<Recurrence>): Recurrence =>
  ({
    id: 'r1',
    label: 'Netflix',
    category: 'Abonnements',
    expectedAmount: -13,
    dayOfMonth: 15,
    active: true,
    ...over,
  }) as Recurrence;

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: 'tx1',
    categorie: 'Abonnements',
    montant: -13,
    date: '2024-03-15',
    libelle: 'Netflix',
    compte: 'LCL',
    pointe: false,
    ...over,
  }) as Transaction;

describe('getPeriodKey', () => {
  it('returns YYYY-MM (compat with existing approvedMonths keys)', () => {
    expect(getPeriodKey('2024-03-15')).toBe('2024-03');
  });
});

describe('getExpectedDate', () => {
  it('clamps the monthly anchor day to the last day of a short month', () => {
    const r = rec({ dayOfMonth: 31 });
    expect(getExpectedDate(r, '2024-02')).toBe('2024-02-29'); // 2024 is a leap year
  });

  it('uses anchorDate day over dayOfMonth when present', () => {
    const r = rec({ dayOfMonth: 1, anchorDate: '2024-01-20' });
    expect(getExpectedDate(r, '2024-03')).toBe('2024-03-20');
  });
});

describe('matchTransaction — la catégorie n’est éliminatoire que sans alias', () => {
  it('matches via alias even when the category differs (or is empty)', () => {
    const r = rec({ aliases: ['netflix'] });
    const candidate = tx({ categorie: 'Autre', libelle: 'Netflix' });
    const result = matchTransaction(r, [candidate]);
    expect(result?.confidence).toBe('strong');
    expect(result?.tx).toBe(candidate);
  });

  it('rejects a weak (no-alias) match when the category differs', () => {
    const r = rec({ dayOfMonth: 15 });
    const candidate = tx({ categorie: 'Autre', libelle: 'Inconnu' });
    expect(matchTransaction(r, [candidate])).toBeNull();
  });

  it('matches via strong alias even far outside the date window, when category matches', () => {
    const r = rec({ aliases: ['netflix'], dayOfMonth: 1 });
    const candidate = tx({ libelle: 'Netflix', date: '2024-03-28' }); // 27 days from anchor
    const result = matchTransaction(r, [candidate]);
    expect(result?.confidence).toBe('strong');
    expect(result?.tx).toBe(candidate);
  });

  it('rejects an alias match outside the ±30% amount tolerance', () => {
    const r = rec({ aliases: ['netflix'], expectedAmount: -13 });
    const candidate = tx({ libelle: 'Netflix', montant: -25 });
    expect(matchTransaction(r, [candidate])).toBeNull();
  });

  it('rejects a match of opposite sign even with a matching alias', () => {
    const r = rec({ aliases: ['netflix'], expectedAmount: -13 });
    const candidate = tx({ libelle: 'Netflix', montant: 13 });
    expect(matchTransaction(r, [candidate])).toBeNull();
  });

  it('falls back to the weak score match when no alias is defined', () => {
    const r = rec({ dayOfMonth: 15 });
    const candidate = tx({ date: '2024-03-16' });
    const result = matchTransaction(r, [candidate]);
    expect(result?.confidence).toBe('weak');
  });

  it('matches within the ±7 day window but not beyond it', () => {
    const r = rec({ dayOfMonth: 15 });
    const close = tx({ id: 'close', date: '2024-03-21' }); // 6 days out
    expect(matchTransaction(r, [close])?.confidence).toBe('weak');
    const far = tx({ id: 'far', date: '2024-03-25' }); // 10 days out
    expect(matchTransaction(r, [far])).toBeNull();
  });

  it('picks the closest alias match by amount/date when several share the alias', () => {
    const r = rec({ aliases: ['netflix'], dayOfMonth: 15 });
    const far = tx({ id: 'far', date: '2024-03-01', montant: -13 });
    const near = tx({ id: 'near', date: '2024-03-15', montant: -13 });
    const result = matchTransaction(r, [far, near]);
    expect(result?.tx.id).toBe('near');
  });

  it('ignores a transaction already excluded (linked to another recurrence)', () => {
    const r = rec({});
    const candidate = tx({});
    expect(matchTransaction(r, [candidate], new Set(['tx1']))).toBeNull();
  });
});

describe('getApprovedTxIds', () => {
  it('collects txId across all recurrences and all approved periods', () => {
    const recurrences = [
      rec({
        id: 'r1',
        approvedMonths: { '2024-02': { txId: 'a', amount: -1, date: '2024-02-01', approvedAt: 0 } },
      }),
      rec({
        id: 'r2',
        approvedMonths: { '2024-03': { txId: 'b', amount: -1, date: '2024-03-01', approvedAt: 0 } },
      }),
    ];
    expect(getApprovedTxIds(recurrences)).toEqual(new Set(['a', 'b']));
  });
});

describe('computePeriodState', () => {
  const today = new Date('2024-03-20');

  it('returns skipped when the period is in skippedPeriods', () => {
    const r = rec({ skippedPeriods: ['2024-03'] });
    const state = computePeriodState(r, '2024-03', [], today);
    expect(state.state).toBe('skipped');
    expect(state.monthOverride?.skipped).toBe(true);
  });

  it('prioritizes an existing approval over a skip flag', () => {
    const r = rec({
      skippedPeriods: ['2024-03'],
      approvedMonths: { '2024-03': { txId: 't1', amount: -13, date: '2024-03-14', approvedAt: 0 } },
    });
    const state = computePeriodState(r, '2024-03', [], today);
    expect(state.state).toBe('approved');
  });

  it('returns overdue when the expected date has passed with no match', () => {
    const r = rec({ dayOfMonth: 5 });
    const state = computePeriodState(r, '2024-03', [], today);
    expect(state.state).toBe('overdue');
  });

  it('returns expected when the expected date is still ahead', () => {
    const r = rec({ dayOfMonth: 28 });
    const state = computePeriodState(r, '2024-03', [], today);
    expect(state.state).toBe('expected');
  });

  it('does not propose a transaction already linked to another recurrence', () => {
    const candidate = tx({});
    const r = rec({ dayOfMonth: 28 }); // expected date ahead, so a match is the only path to 'matched'
    const excludeTxIds = new Set([candidate.id]);
    const state = computePeriodState(r, '2024-03', [candidate], today, excludeTxIds);
    expect(state.state).toBe('expected');
    expect(state.match).toBeUndefined();
  });

  it('returns matched — not approved — when a transaction matches without approval', () => {
    const state = computePeriodState(rec({}), '2024-03', [tx({})], today);
    expect(state.state).toBe('matched');
    expect(state.match?.tx.id).toBe('tx1');
  });
});

describe('isSettled / needsAction', () => {
  it('treats an unapproved match as settled cash but still actionable', () => {
    // L'invariant qui protège le RAV : `matched` est de l'argent sorti (donc
    // déjà compté ailleurs, à ne pas re-provisionner) tout en restant à valider.
    expect(isSettled('matched')).toBe(true);
    expect(needsAction('matched')).toBe(true);
  });

  it('does not treat an expected or skipped occurrence as settled', () => {
    expect(isSettled('expected')).toBe(false);
    expect(isSettled('skipped')).toBe(false);
    expect(isSettled('overdue')).toBe(false);
    expect(isSettled('approved')).toBe(true);
  });

  it('flags overdue as actionable and approved as done', () => {
    expect(needsAction('overdue')).toBe(true);
    expect(needsAction('approved')).toBe(false);
    expect(needsAction('expected')).toBe(false);
  });
});

describe('getLinkCandidates', () => {
  const target = rec({ category: 'Abonnements', expectedAmount: -13 });

  it('prefers same category at comparable amounts', () => {
    const wrongCat = tx({ id: 'a', categorie: 'Courses', montant: -13 });
    const rightCat = tx({ id: 'b', categorie: 'Abonnements', montant: -14 });
    expect(getLinkCandidates(target, [wrongCat, rightCat]).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('lets an exact amount in another category outrank a far-off same-category one', () => {
    // Score mixte assumé : une transaction mal catégorisée au bon montant est
    // souvent le candidat recherché.
    const wrongCatExact = tx({ id: 'a', categorie: 'Courses', montant: -13 });
    const rightCatFar = tx({ id: 'b', categorie: 'Abonnements', montant: -40 });
    expect(getLinkCandidates(target, [rightCatFar, wrongCatExact]).map((t) => t.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('keeps other-category transactions available (manual linking is permissive)', () => {
    const other = tx({ id: 'z', categorie: 'Courses', montant: -500 });
    expect(getLinkCandidates(target, [other]).map((t) => t.id)).toEqual(['z']);
  });

  it('excludes transactions already linked elsewhere and honours the limit', () => {
    const a = tx({ id: 'a' });
    const b = tx({ id: 'b' });
    expect(getLinkCandidates(target, [a, b], new Set(['a'])).map((t) => t.id)).toEqual(['b']);
    expect(getLinkCandidates(target, [a, b], undefined, 1)).toHaveLength(1);
  });

  it('at equal amount, prefers the transaction closest to the expected date', () => {
    const near = tx({ id: 'near', categorie: 'Abonnements', montant: -13, date: '2024-03-15' });
    const far = tx({ id: 'far', categorie: 'Abonnements', montant: -13, date: '2024-03-02' });
    expect(getLinkCandidates(target, [far, near]).map((t) => t.id)).toEqual(['near', 'far']);
  });

  it('relegates but keeps a transaction of the opposite sign', () => {
    const opposite = tx({ id: 'opp', categorie: 'Abonnements', montant: 13 });
    const same = tx({ id: 'same', categorie: 'Abonnements', montant: -13 });
    expect(getLinkCandidates(target, [opposite, same]).map((t) => t.id)).toEqual(['same', 'opp']);
  });
});

describe('getRecurrenceCandidates', () => {
  const source = tx({ categorie: 'Abonnements', montant: -13, date: '2024-03-15' });

  it('prefers same category at comparable amounts', () => {
    const wrongCat = rec({ id: 'a', category: 'Courses', expectedAmount: -13 });
    const rightCat = rec({ id: 'b', category: 'Abonnements', expectedAmount: -14 });
    expect(getRecurrenceCandidates(source, [wrongCat, rightCat]).map((r) => r.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('lets an exact amount in another category outrank a far-off same-category one', () => {
    // L'écart de montant est rapporté au montant ATTENDU de la récurrence : une
    // récurrence à 5 € confrontée à une transaction de 13 € est à 160 % d'écart,
    // ce qui dépasse le coût forfaitaire (100 %) d'une catégorie différente.
    const wrongCatExact = rec({ id: 'a', category: 'Courses', expectedAmount: -13 });
    const rightCatFar = rec({ id: 'b', category: 'Abonnements', expectedAmount: -5 });
    expect(getRecurrenceCandidates(source, [rightCatFar, wrongCatExact]).map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('at equal amount, prefers the recurrence whose due date is closest', () => {
    const near = rec({ id: 'near', dayOfMonth: 14 });
    const far = rec({ id: 'far', dayOfMonth: 2 });
    expect(getRecurrenceCandidates(source, [far, near]).map((r) => r.id)).toEqual(['near', 'far']);
  });

  it('relegates but keeps a recurrence of the opposite sign', () => {
    const opposite = rec({ id: 'opp', expectedAmount: 13 });
    const same = rec({ id: 'same', expectedAmount: -13 });
    expect(getRecurrenceCandidates(source, [opposite, same]).map((r) => r.id)).toEqual([
      'same',
      'opp',
    ]);
  });

  it('honours the limit', () => {
    expect(getRecurrenceCandidates(source, [rec({ id: 'a' }), rec({ id: 'b' })], 1)).toHaveLength(
      1,
    );
  });

  it('shares its barème with getLinkCandidates — a perfect pairing wins on both sides', () => {
    const perfect = rec({ id: 'perfect', category: 'Abonnements', expectedAmount: -13 });
    const poor = rec({ id: 'poor', category: 'Courses', expectedAmount: -60, dayOfMonth: 2 });
    const perfectTx = tx({ id: 'perfect', categorie: 'Abonnements', montant: -13 });
    const poorTx = tx({ id: 'poor', categorie: 'Courses', montant: -60, date: '2024-03-02' });

    expect(getRecurrenceCandidates(source, [poor, perfect]).map((r) => r.id)).toEqual([
      'perfect',
      'poor',
    ]);
    expect(getLinkCandidates(perfect, [poorTx, perfectTx]).map((t) => t.id)).toEqual([
      'perfect',
      'poor',
    ]);
  });
});

describe('getUpcomingOccurrences', () => {
  it('returns a single monthly occurrence within a 30-day window', () => {
    const r = rec({ dayOfMonth: 15 });
    const occ = getUpcomingOccurrences(r, new Date(2024, 2, 1), 30); // 2024-03-01
    expect(occ).toEqual([{ periodKey: '2024-03', date: '2024-03-15' }]);
  });

  it('skips an occurrence whose expected date already passed within the current period', () => {
    const r = rec({ dayOfMonth: 15 });
    const occ = getUpcomingOccurrences(r, new Date(2024, 2, 20), 30); // 2024-03-20
    expect(occ).toEqual([{ periodKey: '2024-04', date: '2024-04-15' }]);
  });
});
