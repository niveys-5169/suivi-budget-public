/**
 * Tests pour buildBalanceMismatchFingerprint()
 * Teste la génération d'empreinte unique pour les divergences de solde
 */

import { describe, it, expect } from 'vitest';
import {
  buildBalanceMismatchFingerprint,
  mouvementsDepuisSolde,
  needsBalanceReview,
} from '../../public/src/utils/balanceMapping';

describe('buildBalanceMismatchFingerprint', () => {
  it('génère un fingerprint pour des inputs valides', () => {
    const fingerprint = buildBalanceMismatchFingerprint({
      id: 'test-1',
      compte: 'Test Account',
      source: 'manual',
      source_timestamp: null,
      current_balance: 5000.0,
      status: 'pending_review',
      ecart: 50.0,
      previousSolde: 5000.0,
      linxoDelta: 48.95,
      computedSolde: 5048.95,
      solde: 5000.0,
    });

    expect(fingerprint).toBeDefined();
    expect(typeof fingerprint).toBe('string');
    expect(fingerprint.length).toBeGreaterThan(0);
  });

  it('retourne le même fingerprint pour des inputs identiques', () => {
    const input = {
      id: 'test-1',
      compte: 'Test Account',
      source: 'manual',
      source_timestamp: null,
      current_balance: 3000.0,
      status: 'pending_review' as any,
      ecart: 100.0,
      previousSolde: 3000.0,
      linxoDelta: 99.5,
      computedSolde: 3099.5,
      solde: 3000.0,
    };

    const fingerprint1 = buildBalanceMismatchFingerprint(input);
    const fingerprint2 = buildBalanceMismatchFingerprint(input);

    expect(fingerprint1).toBe(fingerprint2);
  });

  it('retourne un fingerprint différent quand status change', () => {
    const baseInput = {
      id: 'test-1',
      compte: 'Test Account',
      source: 'manual',
      source_timestamp: null,
      current_balance: 5000.0,
      ecart: 50.0,
      previousSolde: 5000.0,
      linxoDelta: 48.95,
      computedSolde: 5048.95,
      solde: 5000.0,
    };

    const fingerprint1 = buildBalanceMismatchFingerprint({
      ...baseInput,
      status: 'pending_review',
    });

    const fingerprint2 = buildBalanceMismatchFingerprint({
      ...baseInput,
      status: 'acknowledged' as any,
    });

    expect(fingerprint1).not.toBe(fingerprint2);
  });

  it('gère les champs manquants/undefined gracieusement', () => {
    const input = {
      id: 'test-1',
      compte: 'Test Account',
      source: 'manual',
      source_timestamp: null,
      current_balance: 5000.0,
      status: 'pending_review' as any,
      ecart: 50.0,
      previousSolde: undefined as any,
      linxoDelta: 48.95,
      computedSolde: 5048.95,
      solde: 5000.0,
    };

    expect(() => {
      buildBalanceMismatchFingerprint(input);
    }).not.toThrow();
  });

  it('retourne un fingerprint différent quand solde change', () => {
    const input1 = {
      id: 'test-1',
      compte: 'Test Account',
      source: 'manual',
      source_timestamp: null,
      current_balance: 5000.0,
      status: 'pending_review' as any,
      ecart: 50.0,
      previousSolde: 5000.0,
      linxoDelta: 48.95,
      computedSolde: 5048.95,
      solde: 5000.0,
    };

    const input2 = {
      ...input1,
      current_balance: 5500.0, // Changement significatif
    };

    const fingerprint1 = buildBalanceMismatchFingerprint(input1);
    const fingerprint2 = buildBalanceMismatchFingerprint(input2);

    expect(fingerprint1).not.toBe(fingerprint2);
  });

  it('est stable pour zéros et nombres spéciaux', () => {
    const input = {
      id: 'test-1',
      compte: 'Test Account',
      source: 'manual',
      source_timestamp: null,
      current_balance: 0.0,
      status: 'pending_review' as any,
      ecart: 0.0,
      previousSolde: 0.0,
      linxoDelta: 0.0,
      computedSolde: 0.0,
      solde: 0.0,
    };

    const fingerprint = buildBalanceMismatchFingerprint(input);
    expect(fingerprint).toBeDefined();
    expect(typeof fingerprint).toBe('string');
  });
});

describe('needsBalanceReview', () => {
  const base = {
    id: 'BforBank',
    compte: 'BforBank',
    source: 'gmail',
    source_timestamp: null,
    current_balance: 515.98,
    ecart: 208.38,
    previousSolde: 307.6,
    linxoDelta: 0,
    computedSolde: 307.6,
  };

  it('signale un solde pending_review', () => {
    expect(needsBalanceReview({ ...base, status: 'pending_review' })).toBe(true);
  });

  it('ignore un solde réconcilié', () => {
    expect(needsBalanceReview({ ...base, status: 'reconciled', ecart: 0 })).toBe(false);
  });

  it('signale un écart non résolu tant qu’il n’est pas accepté', () => {
    const r = { ...base, status: 'discrepancy_unresolved' as const };
    expect(needsBalanceReview(r)).toBe(true);
    expect(
      needsBalanceReview({ ...r, mismatchAckFingerprint: buildBalanceMismatchFingerprint(r) }),
    ).toBe(false);
  });
});

describe('mouvementsDepuisSolde', () => {
  const at = (iso: string) => ({ toDate: () => new Date(iso) });
  const solde = {
    compte: 'BforBank',
    emailDate: at('2026-09-24T04:19:46Z'),
  } as unknown as Parameters<typeof mouvementsDepuisSolde>[0];
  const tx = (montant: number, compte: string, emailDate?: string) => ({
    montant,
    compte,
    emailDate: emailDate ? new Date(emailDate) : undefined,
  });

  it('additionne les transactions du compte arrivées après le mail du solde', () => {
    // Cas réel : mail du 25/09 dont le « Solde bas » n'avait pas été lu.
    const result = mouvementsDepuisSolde(solde, [
      tx(-68.38, 'BforBank', '2026-09-25T04:23:45Z'),
      tx(-140, 'BforBank', '2026-09-25T04:23:45Z'),
    ]);
    expect(result).toEqual({ total: -208.38, count: 2 });
  });

  it('exclut le mail du solde lui-même, les autres comptes et les saisies sans emailDate', () => {
    const result = mouvementsDepuisSolde(solde, [
      tx(-8.88, 'BforBank', '2026-09-24T04:19:46Z'),
      tx(-50, 'LCL', '2026-09-25T04:23:45Z'),
      tx(-12, 'BforBank'),
      tx(-30, 'BforBank', '2026-09-20T04:00:00Z'),
    ]);
    expect(result).toEqual({ total: 0, count: 0 });
  });

  it('additionne au centime près', () => {
    const result = mouvementsDepuisSolde(solde, [
      tx(-0.1, 'BforBank', '2026-09-25T04:00:00Z'),
      tx(-0.2, 'BforBank', '2026-09-25T04:00:00Z'),
    ]);
    expect(result).toEqual({ total: -0.3, count: 2 });
  });

  it('renvoie null sans emailDate de solde (rien à comparer)', () => {
    const sansDate = { compte: 'BforBank' } as unknown as Parameters<
      typeof mouvementsDepuisSolde
    >[0];
    expect(mouvementsDepuisSolde(sansDate, [tx(-1, 'BforBank', '2026-09-25T04:00:00Z')])).toBe(
      null,
    );
  });
});
