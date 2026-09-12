import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useRecurrences } from '../useRecurrences';
import { useGlobalData } from '../../context/GlobalDataContext';
import { useTransactions } from '../useTransactions';
import {
  addRecurrenceAlias,
  approveRecurrenceMatch,
  skipRecurrencePeriod,
  unapproveRecurrenceMonth,
  unlinkRecurrenceTx,
  unskipRecurrencePeriod,
} from '../recurrencesService';
import type { Recurrence, Transaction } from '../../types/banking.types';

vi.mock('../../context/GlobalDataContext', () => ({ useGlobalData: vi.fn() }));
vi.mock('../useTransactions', () => ({ useTransactions: vi.fn() }));
vi.mock('../../lib/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock('../recurrencesService', () => ({
  addRecurrenceAlias: vi.fn(),
  approveRecurrenceMatch: vi.fn(),
  removeRecurrence: vi.fn(),
  setRecurrenceActive: vi.fn(),
  skipRecurrencePeriod: vi.fn(),
  unapproveRecurrenceMonth: vi.fn(),
  unlinkRecurrenceTx: vi.fn(),
  unskipRecurrencePeriod: vi.fn(),
  updateRecurrence: vi.fn(),
}));

const MONTH = '2026-06';

const rec = (over: Partial<Recurrence>): Recurrence =>
  ({
    id: 'rec-1',
    label: 'Netflix',
    category: 'Abonnement',
    expectedAmount: -13.99,
    anchorDate: '2026-01-15',
    active: true,
    approvedMonths: {},
    createdAt: Timestamp.now(),
    ...over,
  }) as Recurrence;

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: 'tx-1',
    date: '2026-06-15',
    libelle: 'Netflix',
    categorie: 'Abonnement',
    montant: -13.99,
    pointe: false,
    ...over,
  }) as Transaction;

const togglePointe = vi.fn();
const bulkUpdate = vi.fn();

function setup(recurrences: Recurrence[], transactions: Transaction[] = []) {
  (useGlobalData as any).mockReturnValue({ recurrences });
  (useTransactions as any).mockReturnValue({ transactions, togglePointe, bulkUpdate });
  return renderHook(() => useRecurrences(MONTH));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-20'));
});

describe('useRecurrences — états', () => {
  it('classe une tx appariée non approuvée en `matched`, pas en payé', () => {
    // Le bug d'origine : cet état était « en attente » sur un écran et
    // « réalisé » sur l'autre. Il n'y a désormais qu'une réponse.
    const { result } = setup([rec({})], [tx({})]);

    expect(result.current.items[0]!.state).toBe('matched');
    expect(result.current.byState.approved).toHaveLength(0);
    expect(result.current.items[0]!.match?.id).toBe('tx-1');
  });

  it('classe une approbation en `approved` avec le montant réellement approuvé', () => {
    const approved = rec({
      approvedMonths: {
        [MONTH]: { txId: 'tx-9', amount: -15.5, date: '2026-06-15', approvedAt: 0 },
      },
    });
    const { result } = setup([approved]);

    expect(result.current.items[0]!.state).toBe('approved');
    expect(result.current.items[0]!.displayAmount).toBe(-15.5);
    expect(result.current.items[0]!.match).toBeNull();
  });

  it('distingue `overdue` et `expected` selon la date attendue', () => {
    const past = rec({ id: 'r-past', anchorDate: '2026-01-05' });
    const future = rec({ id: 'r-future', anchorDate: '2026-01-28' });
    const { result } = setup([past, future]);

    expect(result.current.byState.overdue.map((r) => r.id)).toEqual(['r-past']);
    expect(result.current.byState.expected.map((r) => r.id)).toEqual(['r-future']);
  });

  it("n'attribue jamais la même transaction à deux récurrences", () => {
    const a = rec({ id: 'r-a', anchorDate: '2026-01-15' });
    const b = rec({ id: 'r-b', anchorDate: '2026-01-16' });
    const { result } = setup([a, b], [tx({})]);

    const matched = result.current.items.filter((r) => r.state === 'matched');
    expect(matched).toHaveLength(1);
    expect(matched[0]!.id).toBe('r-a');
  });

  it('retient le mois d’affectation plutôt que la date de la transaction', () => {
    // Règle unifiée : les deux pipelines historiques divergeaient sur ce point.
    const outOfMonth = tx({ date: '2026-05-15', moisAffectation: MONTH });
    const { result } = setup([rec({})], [outOfMonth]);

    expect(result.current.monthTransactions).toHaveLength(1);
  });

  it('sépare revenus et dépenses au lieu de masquer les revenus', () => {
    const salary = rec({ id: 'r-sal', label: 'Salaire', expectedAmount: 2500 });
    const { result } = setup([rec({}), salary]);

    expect(result.current.incomes.map((r) => r.id)).toEqual(['r-sal']);
    expect(result.current.expenses.map((r) => r.id)).toEqual(['rec-1']);
  });

  it('exclut les récurrences inactives', () => {
    const { result } = setup([rec({ active: false })]);
    expect(result.current.items).toHaveLength(0);
  });

  it('un alias reconnu revendique sa transaction même si une récurrence antérieure la matchait faiblement', () => {
    // Avant le correctif : r-early (jour 3) triée en premier raflait la tx par
    // coïncidence de montant, laissant r-late (jour 18, alias exact) sans rien.
    const early = rec({ id: 'r-early', label: 'Autre', anchorDate: '2026-01-03' });
    const late = rec({
      id: 'r-late',
      label: 'Netflix',
      anchorDate: '2026-01-18',
      aliases: ['netflix'],
    });
    const { result } = setup([early, late], [tx({ date: '2026-06-05' })]);

    expect(result.current.items.find((r) => r.id === 'r-late')!.state).toBe('matched');
    expect(result.current.items.find((r) => r.id === 'r-early')!.state).not.toBe('matched');
  });
});

describe('useRecurrences — totaux', () => {
  it('ne compte comme payé que ce qui est approuvé, et pas les revenus', () => {
    const approved = rec({
      id: 'r-ok',
      expectedAmount: -20,
      approvedMonths: {
        [MONTH]: { txId: 'tx-9', amount: -20, date: '2026-06-15', approvedAt: 0 },
      },
    });
    const salary = rec({
      id: 'r-sal',
      label: 'Salaire',
      expectedAmount: 2500,
      approvedMonths: {
        [MONTH]: { txId: 'tx-8', amount: 2500, date: '2026-06-01', approvedAt: 0 },
      },
    });
    const { result } = setup([approved, salary, rec({ id: 'r-todo', expectedAmount: -30 })]);

    expect(result.current.totals.approvedThisMonth).toBe(20);
    expect(result.current.totals.incomeReceived).toBe(2500);
    expect(result.current.totals.commitment).toBeCloseTo(50);
    expect(result.current.totals.remaining).toBe(30);
  });

  it('sort une récurrence en pause du reste à payer', () => {
    const paused = rec({ id: 'r-skip', expectedAmount: -30, skippedPeriods: [MONTH] });
    const { result } = setup([paused]);

    expect(result.current.byState.skipped).toHaveLength(1);
    expect(result.current.totals.remaining).toBe(0);
  });
});

describe('useRecurrences — commandes', () => {
  it('approuver apprend l’alias ET pointe la transaction', async () => {
    // Auparavant l'alias n'était appris que depuis /recurring et le pointage
    // que depuis la liste de transactions.
    const { result } = setup([rec({})], [tx({})]);

    await act(async () => {
      await result.current.approve(result.current.items[0]!);
    });

    expect(approveRecurrenceMatch).toHaveBeenCalledWith('rec-1', MONTH, expect.anything());
    expect(addRecurrenceAlias).toHaveBeenCalledWith('rec-1', 'Netflix');
    expect(togglePointe).toHaveBeenCalledWith('tx-1', true);
  });

  it('ne re-pointe pas une transaction déjà pointée', async () => {
    const { result } = setup([rec({})], [tx({ pointe: true })]);

    await act(async () => {
      await result.current.link(result.current.items[0]!, tx({ pointe: true }));
    });

    expect(togglePointe).not.toHaveBeenCalled();
  });

  it('catégorise une transaction liée qui ne l’était pas encore', async () => {
    // Contrepartie de l'assouplissement du matcher : un alias reconnu peut
    // désormais apparier une tx sans catégorie, sans quoi le RAV la perdrait.
    const { result } = setup([rec({})], [tx({ categorie: '' })]);

    await act(async () => {
      await result.current.link(rec({}), tx({ categorie: '' }));
    });

    expect(bulkUpdate).toHaveBeenCalledWith(['tx-1'], { categorie: 'Abonnement' });
  });

  it('ne réécrit pas une catégorie déjà alignée sur la récurrence', async () => {
    const { result } = setup([rec({})], [tx({})]);

    await act(async () => {
      await result.current.link(rec({}), tx({}));
    });

    expect(bulkUpdate).not.toHaveBeenCalled();
  });

  it('réaligne une transaction catégorisée différemment de la récurrence', async () => {
    const { result } = setup([rec({})], [tx({ categorie: 'Alimentation' })]);

    await act(async () => {
      await result.current.link(rec({}), tx({ categorie: 'Alimentation' }));
    });

    expect(bulkUpdate).toHaveBeenCalledWith(['tx-1'], { categorie: 'Abonnement' });
  });

  it('rétablir une récurrence en pause n’émet qu’une seule écriture', async () => {
    // AnalyseSection appelait auparavant unapprove ET unskip à l'aveugle.
    const { result } = setup([rec({ skippedPeriods: [MONTH] })]);

    await act(async () => {
      await result.current.unskip(result.current.items[0]!);
    });

    expect(unskipRecurrencePeriod).toHaveBeenCalledWith('rec-1', MONTH);
    expect(unapproveRecurrenceMonth).not.toHaveBeenCalled();
  });

  it('désapprouver n’émet qu’une seule écriture', async () => {
    const approved = rec({
      approvedMonths: {
        [MONTH]: { txId: 'tx-9', amount: -13.99, date: '2026-06-15', approvedAt: 0 },
      },
    });
    const { result } = setup([approved]);

    await act(async () => {
      await result.current.unapprove(result.current.items[0]!);
    });

    expect(unapproveRecurrenceMonth).toHaveBeenCalledWith('rec-1', MONTH);
    expect(unskipRecurrencePeriod).not.toHaveBeenCalled();
  });

  it('met en pause sur la période affichée', async () => {
    const { result } = setup([rec({})]);

    await act(async () => {
      await result.current.skip(result.current.items[0]!);
    });

    expect(skipRecurrencePeriod).toHaveBeenCalledWith('rec-1', MONTH);
  });

  it('délie une seule transaction via le service dédié', async () => {
    const { result } = setup([rec({})]);

    await act(async () => {
      await result.current.unlink('rec-1', 'tx-1');
    });

    expect(unlinkRecurrenceTx).toHaveBeenCalledWith('rec-1', 'tx-1');
  });
});

describe('useRecurrences — badges et candidats', () => {
  it('expose les tx liées de toutes les périodes et les candidates du mois', () => {
    const linkedElsewhere = rec({
      id: 'r-old',
      label: 'Spotify',
      expectedAmount: -10,
      approvedMonths: {
        '2026-01': { txId: 'tx-old', amount: -10, date: '2026-01-10', approvedAt: 0 },
      },
    });
    const { result } = setup([rec({}), linkedElsewhere], [tx({})]);

    // Le badge « lié » suit la transaction même hors du mois affiché.
    expect(result.current.mappings.linkedTxToRecurrence['tx-old']!.id).toBe('r-old');
    expect(result.current.mappings.candidateTxToRecurrence['tx-1']!.id).toBe('rec-1');
  });

  it('classe les candidats au rattachement et écarte les tx déjà liées', () => {
    const other = tx({ id: 'tx-2', categorie: 'Courses', montant: -200 });
    const linked = rec({
      id: 'r-old',
      approvedMonths: {
        [MONTH]: { txId: 'tx-3', amount: -50, date: '2026-06-02', approvedAt: 0 },
      },
    });
    const { result } = setup(
      [rec({}), linked],
      [tx({}), other, tx({ id: 'tx-3', montant: -50, date: '2026-06-02' })],
    );

    const ids = result.current.linkCandidates(rec({})).map((t) => t.id);
    expect(ids[0]).toBe('tx-1');
    expect(ids).not.toContain('tx-3');
  });

  it('classe les récurrences candidates pour une transaction', () => {
    const netflix = rec({ id: 'rec-1', category: 'Abonnement', expectedAmount: -13.99 });
    const courses = rec({
      id: 'rec-2',
      label: 'Courses',
      category: 'Courses',
      expectedAmount: -13.99,
    });
    const { result } = setup([courses, netflix], [tx({})]);

    const ids = result.current.recurrenceCandidates(tx({})).map((r) => r.id);
    expect(ids).toEqual(['rec-1', 'rec-2']);
  });

  it('écarte une récurrence déjà approuvée pour le mois, garde les autres états', () => {
    const settled = rec({
      id: 'r-settled',
      label: 'Spotify',
      approvedMonths: {
        [MONTH]: { txId: 'tx-9', amount: -10, date: '2026-06-05', approvedAt: 0 },
      },
    });
    const paused = rec({ id: 'r-paused', label: 'Canal', active: false });
    const { result } = setup([rec({}), settled, paused], []);

    const ids = result.current.recurrenceCandidates(tx({})).map((r) => r.id);
    expect(ids).toContain('rec-1');
    expect(ids).not.toContain('r-settled'); // réglée ce mois
    expect(ids).not.toContain('r-paused'); // inactive
  });

  it('propose une transaction du mois précédent', () => {
    // Une charge de juin débitée fin mai était invisible tant que le vivier de
    // liaison manuelle se limitait au mois affiché.
    const prevMonthTx = tx({ id: 'tx-prev', date: '2026-05-30' });
    const { result } = setup([rec({})], [prevMonthTx]);

    const ids = result.current.linkCandidates(rec({})).map((t) => t.id);
    expect(ids).toContain('tx-prev');
  });
});
