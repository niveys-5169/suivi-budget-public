import type { Credit } from '../types/banking.types';

/**
 * Amortissement à mensualité constante pour un crédit à taux fixe. Fonctions
 * pures, sans dépendance React ni Firestore — voir `docs/ARCH_STATE.md` et
 * `hooks/useCredits.ts` pour la partie persistée.
 */

/** Taux périodique (mensuel) à partir du taux nominal annuel en %. */
function tauxMensuel(credit: Credit): number {
  return credit.tauxAnnuel / 12 / 100;
}

/** Mensualité du crédit (hors assurance) : `C·r / (1 − (1+r)^−n)`, ou `C/n` si `r = 0`. */
export function mensualite(credit: Credit): number {
  const { capitalInitial: C, dureeMois: n } = credit;
  if (n <= 0) return 0;
  const r = tauxMensuel(credit);
  if (r === 0) return C / n;
  return (C * r) / (1 - Math.pow(1 + r, -n));
}

const parseISODate = (iso: string): Date => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Date de la `i`-ième échéance (0 = la 1ère). Le jour de `dateDebut` est
 * ramené au dernier jour des mois plus courts (31/01 → 29/02 → 31/03).
 */
function dateEcheance(start: Date, i: number): Date {
  const year = start.getFullYear();
  const month = start.getMonth() + i;
  const dernierJour = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(start.getDate(), dernierJour));
}

/**
 * Nombre d'échéances honorées à `date` incluse. La 1ère échéance tombe le
 * jour `dateDebut` : à cette date, `k = 1`. Borné à `[0, dureeMois]`.
 */
function echeancesPayees(credit: Credit, date: Date): number {
  const start = parseISODate(credit.dateDebut);
  let months =
    (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
  if (date < dateEcheance(start, months)) months -= 1;
  const k = months + 1;
  return Math.max(0, Math.min(credit.dureeMois, k));
}

/**
 * Capital restant dû après les échéances honorées jusqu'à `date`. Avant le
 * début, retourne le capital initial ; après la fin, `0`.
 */
export function capitalRestantDu(credit: Credit, date: Date): number {
  const k = echeancesPayees(credit, date);
  const { capitalInitial: C, dureeMois: n } = credit;
  if (k <= 0) return C;
  if (k >= n) return 0;
  const r = tauxMensuel(credit);
  if (r === 0) return C - (C / n) * k;
  const M = mensualite(credit);
  const facteur = Math.pow(1 + r, k);
  return Math.max(0, C * facteur - (M * (facteur - 1)) / r);
}

/** Date de la dernière échéance (celle qui ramène le capital restant dû à 0). */
export function dateFin(credit: Credit): Date {
  return dateEcheance(parseISODate(credit.dateDebut), Math.max(0, credit.dureeMois - 1));
}

export interface LiberationAnnee {
  annee: number;
  creditsTermines: string[];
  mensualiteLiberee: number;
  mensualiteRestante: number;
}

/** Paiement mensuel total d'un crédit : mensualité + assurance si renseignée. */
export function paiementMensuel(credit: Credit): number {
  return mensualite(credit) + (credit.assuranceMensuelle || 0);
}

/**
 * Calendrier des fins de crédit à partir de `today` : pour chaque année où au
 * moins un crédit se termine, la mensualité libérée cette année-là et la
 * mensualité totale restante une fois cette libération effective.
 */
export function liberationsParAnnee(credits: Credit[], today: Date): LiberationAnnee[] {
  const active = credits.filter((c) => capitalRestantDu(c, today) > 0);
  const total = active.reduce((sum, c) => sum + paiementMensuel(c), 0);

  const byYear = new Map<number, Credit[]>();
  active.forEach((c) => {
    const year = dateFin(c).getFullYear();
    const list = byYear.get(year) || [];
    list.push(c);
    byYear.set(year, list);
  });

  const years = [...byYear.keys()].sort((a, b) => a - b);
  let cumulativeFreed = 0;

  return years.map((annee) => {
    const creditsAnnee = byYear.get(annee)!;
    const mensualiteLiberee = creditsAnnee.reduce((sum, c) => sum + paiementMensuel(c), 0);
    cumulativeFreed += mensualiteLiberee;
    return {
      annee,
      creditsTermines: creditsAnnee.map((c) => c.nom),
      mensualiteLiberee,
      mensualiteRestante: Math.max(0, total - cumulativeFreed),
    };
  });
}

/** Somme des paiements mensuels (assurance comprise) des crédits encore en cours à `today`. */
export function mensualitesEnCours(credits: Credit[], today: Date): number {
  return credits.reduce(
    (sum, c) => sum + (capitalRestantDu(c, today) > 0 ? paiementMensuel(c) : 0),
    0,
  );
}

/** Taux d'endettement (mensualités / revenus). `null` si les revenus sont ≤ 0. */
export function tauxEndettement(
  mensualitesTotales: number,
  revenusMensuels: number,
): number | null {
  if (revenusMensuels <= 0) return null;
  return mensualitesTotales / revenusMensuels;
}

export interface Couverture {
  ratio: number;
  surplus: number;
}

/** Couverture du capital restant dû par des actifs donnés. `null` si `crd = 0`. */
export function couverture(actifs: number, crd: number): Couverture | null {
  if (crd === 0) return null;
  return { ratio: actifs / crd, surplus: actifs - crd };
}

/**
 * Première année où le capital restant dû projeté (fin d'année, actifs
 * constants) passe sous les actifs donnés. Retourne l'année courante si déjà
 * couvert, et au plus tard l'année de fin du dernier crédit.
 */
export function anneeCouverture(credits: Credit[], actifs: number, today: Date): number {
  const year = today.getFullYear();
  const totalCrd = (date: Date) => credits.reduce((sum, c) => sum + capitalRestantDu(c, date), 0);

  if (actifs >= totalCrd(today)) return year;

  const maxEndYear = credits.reduce((max, c) => Math.max(max, dateFin(c).getFullYear()), year);
  for (let y = year + 1; y <= maxEndYear; y++) {
    if (actifs >= totalCrd(new Date(y, 11, 31))) return y;
  }
  return maxEndYear;
}
