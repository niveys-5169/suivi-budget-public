import { describe, it, expect } from 'vitest';
import { getPageTitle } from '../useDocumentTitle';

describe('getPageTitle', () => {
  it('donne le titre du tableau de bord sur la racine', () => {
    expect(getPageTitle('/')).toBe('« Tableau de bord — AURUM »');
  });

  it('reconnaît un sous-chemin de Budgets', () => {
    expect(getPageTitle('/budgets/x')).toBe('« Budgets — AURUM »');
  });

  it('reconnaît une semaine datée', () => {
    expect(getPageTitle('/semaine/2026-11-08')).toBe('« Ma semaine — AURUM »');
  });

  it('retombe sur le titre générique pour un chemin inconnu', () => {
    expect(getPageTitle('/inconnu')).toBe('AURUM — Suivi Budget');
  });
});
