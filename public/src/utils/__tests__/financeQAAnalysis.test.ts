import { describe, it, expect } from 'vitest';
import { buildYearEndProjection, questionNeedsWebSearch } from '../financeQAAnalysis';
import type { Transaction } from '../../types/banking.types';

const tx = (date: string, montant: number, categorie = 'Courses'): Transaction =>
  ({
    id: `${date}-${montant}-${categorie}`,
    date,
    montant,
    categorie,
    libelle: 'x',
  }) as Transaction;

describe('buildYearEndProjection', () => {
  const today = new Date(2026, 8, 27); // 27/09/2026 → 8 mois écoulés, 4 restants

  it('projette le solde net annuel à partir de la moyenne des mois complets', () => {
    const txs = [
      tx('2026-07-05', 3000, 'Salaire'),
      tx('2026-07-10', -2000),
      tx('2026-08-05', 3000, 'Salaire'),
      tx('2026-08-10', -2500),
      tx('2026-09-05', -9999), // mois en cours : ignoré
    ];
    const p = buildYearEndProjection(txs, today)!;
    expect(p.mois_ecoules).toBe(8);
    expect(p.mois_restants).toBe(4);
    expect(p.cumul_mois_ecoules).toEqual({ recettes: 6000, depenses: -4500, solde_net: 1500 });
    expect(p.moyenne_mensuelle).toEqual({
      recettes: 3000,
      depenses: -2250,
      solde_net: 750,
      nb_mois: 2,
    });
    expect(p.solde_net_annuel_projete).toBe(1500 + 750 * 4);
  });

  it('exclut les virements internes et les flux d’épargne', () => {
    const txs = [
      tx('2026-08-05', 3000, 'Salaire'),
      tx('2026-08-06', -1000, 'Virement interne'),
      tx('2026-08-07', -500, 'Épargne'),
    ];
    const p = buildYearEndProjection(txs, today)!;
    expect(p.cumul_mois_ecoules.depenses).toBe(0);
  });

  it('ne garde que les 12 derniers mois pour la moyenne', () => {
    const txs = [tx('2024-01-10', -10000), tx('2025-09-10', -100), tx('2026-08-10', -100)];
    expect(buildYearEndProjection(txs, today)!.moyenne_mensuelle.nb_mois).toBe(2);
  });

  it('renvoie undefined sans mois complet', () => {
    expect(buildYearEndProjection([tx('2026-09-01', -10)], today)).toBeUndefined();
  });
});

describe('questionNeedsWebSearch', () => {
  it.each([
    "est-ce que si j'achète une trottinette à 579€ ça va poser problème dans mon budget en fin d'année ?",
    "c'est quoi le problème avec la charge de la dette ?",
    'Combien ai-je dépensé en santé cette année ?',
    'Quel est le plafond de mon budget courses ?',
  ])('reste hors ligne pour une question personnelle : %s', (q) => {
    expect(questionNeedsWebSearch(q)).toBe(false);
  });

  it.each([
    'Quel est le taux du Livret A ?',
    "Quelle est l'inflation actuelle ?",
    'Comment évolue le CAC 40 ?',
    'Quelle est ma tranche d’impôt ?',
  ])('active le web pour une info externe : %s', (q) => {
    expect(questionNeedsWebSearch(q)).toBe(true);
  });
});
