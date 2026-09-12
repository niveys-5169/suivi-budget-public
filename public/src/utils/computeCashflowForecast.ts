/**
 * @file computeCashflowForecast.ts
 * @description Projection pure du solde bancaire jour par jour à partir des flux
 * récurrents (dépenses détectées + revenus déclarés), avec détection des creux de
 * trésorerie sous un seuil de sécurité. Fonction pure, sans dépendance React/Firestore.
 */

export interface ForecastRecurringExpense {
  key: string;
  label: string;
  avgAmount: number; // valeur absolue (toujours positive)
  dayOfMonth: number; // 1..31 — repli si occurrenceDates absent
  /** Dates ISO précises dans l'horizon (calculées par recurrenceEngine.getUpcomingOccurrences).
   *  Prioritaire sur dayOfMonth : permet les fréquences non mensuelles. */
  occurrenceDates?: string[];
}

export interface ForecastRecurringIncome {
  key: string;
  label: string;
  amount: number; // valeur positive
  dayOfMonth: number; // 1..31 — repli si occurrenceDates absent
  occurrenceDates?: string[];
}

export interface ForecastEvent {
  date: string; // YYYY-MM-DD
  label: string;
  amount: number; // signé : + entrée, - sortie
  type: 'income' | 'expense';
  sourceKey: string;
}

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  balance: number; // solde projeté en fin de journée
  events: ForecastEvent[];
}

export interface CashflowForecast {
  days: ForecastDay[];
  lowestPoint: { date: string; balance: number };
  breachDate: string | null; // 1ère date sous le seuil de sécurité
  belowZeroDate: string | null; // 1ère date négative
  upcomingEvents: ForecastEvent[]; // events triés par date (max 12)
}

export interface CashflowForecastInput {
  startBalance: number;
  startDate: Date;
  horizonDays: number; // 30 | 60 | 90
  recurringExpenses: ForecastRecurringExpense[];
  recurringIncomes: ForecastRecurringIncome[];
  safetyThreshold: number;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Jour effectif du mois pour une échéance (clamp sur le dernier jour du mois). */
function effectiveDay(dayOfMonth: number, date: Date): number {
  const max = daysInMonth(date.getFullYear(), date.getMonth());
  return Math.min(Math.max(1, Math.round(dayOfMonth) || 1), max);
}

/** Projette le solde sur `horizonDays` jours à partir des flux récurrents. */
export function computeCashflowForecast(input: CashflowForecastInput): CashflowForecast {
  const {
    startBalance,
    startDate,
    horizonDays,
    recurringExpenses,
    recurringIncomes,
    safetyThreshold,
  } = input;

  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  const days: ForecastDay[] = [];
  const allEvents: ForecastEvent[] = [];
  let running = startBalance;
  let breachDate: string | null = null;
  let belowZeroDate: string | null = null;
  let lowestPoint = { date: toKey(start), balance: startBalance };

  for (let offset = 0; offset <= horizonDays; offset++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const key = toKey(date);
    const dayEvents: ForecastEvent[] = [];

    for (const exp of recurringExpenses) {
      const fires = exp.occurrenceDates
        ? exp.occurrenceDates.includes(key)
        : date.getDate() === effectiveDay(exp.dayOfMonth, date);
      if (fires) {
        dayEvents.push({
          date: key,
          label: exp.label,
          amount: -Math.abs(exp.avgAmount),
          type: 'expense',
          sourceKey: exp.key,
        });
      }
    }
    for (const inc of recurringIncomes) {
      const fires = inc.occurrenceDates
        ? inc.occurrenceDates.includes(key)
        : date.getDate() === effectiveDay(inc.dayOfMonth, date);
      if (fires) {
        dayEvents.push({
          date: key,
          label: inc.label,
          amount: Math.abs(inc.amount),
          type: 'income',
          sourceKey: inc.key,
        });
      }
    }

    // On ignore les événements du jour de départ (offset 0) : ils sont déjà
    // réputés intégrés au solde actuel.
    if (offset > 0) {
      for (const ev of dayEvents) {
        running += ev.amount;
        allEvents.push(ev);
      }
    }

    days.push({ date: key, balance: running, events: offset > 0 ? dayEvents : [] });

    if (running < lowestPoint.balance) lowestPoint = { date: key, balance: running };
    if (breachDate === null && running < safetyThreshold) breachDate = key;
    if (belowZeroDate === null && running < 0) belowZeroDate = key;
  }

  const upcomingEvents = [...allEvents].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);

  return { days, lowestPoint, breachDate, belowZeroDate, upcomingEvents };
}
