import React, { useMemo, useState } from 'react';
import { useCashflowForecast, type ForecastHorizon } from '../../../hooks/useCashflowForecast';
import { formatCurrency } from '../../../lib/formatters';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronDown,
  TrendingDown,
} from 'lucide-react';
import { Button } from '../../../ui';

export const AurumCashflowCard: React.FC = () => {
  const threshold = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const stored = Number(localStorage.getItem('cashflow_safety_threshold'));
    return Number.isFinite(stored) ? stored : 0;
  }, []);

  const [horizon, setHorizon] = useState<ForecastHorizon>(30);
  const [isExpanded, setIsExpanded] = useState(false);
  const forecast = useCashflowForecast(horizon, threshold);
  const breach = forecast.belowZeroDate ?? forecast.breachDate;
  const hasData = forecast.days.length > 1;

  const displayedEvents = useMemo(() => {
    if (!forecast.lowestPoint.date) return [];

    // Événements avant le point bas (dépenses et revenus)
    const beforeLowest = forecast.days
      .filter((day) => day.date <= forecast.lowestPoint.date)
      .flatMap((day) => day.events);

    // Revenus (entrées) après le point bas jusqu'à la fin de l'horizon
    const incomesAfterLowest = forecast.days
      .filter((day) => day.date > forecast.lowestPoint.date)
      .flatMap((day) => day.events)
      .filter((ev) => ev.type === 'income');

    // Fusionner et trier par date
    return [...beforeLowest, ...incomesAfterLowest].sort((a, b) => a.date.localeCompare(b.date));
  }, [forecast.days, forecast.lowestPoint.date]);

  if (!hasData) {
    return (
      <section className="rounded-xl p-8 bg-surface border border-separator backdrop-blur-3xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
            <TrendingDown size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-caption font-semibold text-label-tertiary">Trésorerie —</p>
              <select
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value) as ForecastHorizon)}
                className="bg-transparent border-none text-gold font-semibold text-caption focus:outline-none cursor-pointer appearance-none pr-4"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 10 6'><path fill='%23D4AF37' d='M0,0 L10,0 L5,6 Z'/></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 2px center',
                }}
              >
                <option value={30} className="bg-bg text-label">
                  30 jours
                </option>
                <option value={60} className="bg-bg text-label">
                  60 jours
                </option>
                <option value={90} className="bg-bg text-label">
                  90 jours
                </option>
              </select>
            </div>
            <h3 className="text-lg font-bold tracking-tight text-label">Projection</h3>
          </div>
        </div>
        <p className="text-sm text-label-tertiary py-4 text-center">
          Données insuffisantes pour projeter une tendance.
        </p>
      </section>
    );
  }

  const lowestDateFormatted = forecast.lowestPoint.date
    ? new Date(forecast.lowestPoint.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
      })
    : '';

  const lowestIsSafe = forecast.lowestPoint.balance >= threshold;

  return (
    <section className="rounded-xl p-8 bg-surface border border-separator backdrop-blur-3xl space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
            <TrendingDown size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-caption font-semibold text-label-tertiary">Trésorerie —</p>
              <select
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value) as ForecastHorizon)}
                className="bg-transparent border-none text-gold font-semibold text-caption focus:outline-none cursor-pointer appearance-none pr-4"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 10 6'><path fill='%23D4AF37' d='M0,0 L10,0 L5,6 Z'/></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 2px center',
                }}
              >
                <option value={30} className="bg-bg text-label">
                  30 jours
                </option>
                <option value={60} className="bg-bg text-label">
                  60 jours
                </option>
                <option value={90} className="bg-bg text-label">
                  90 jours
                </option>
              </select>
            </div>
            <h3 className="text-lg font-bold tracking-tight text-label">Projection</h3>
          </div>
        </div>
        <div className="text-right">
          <p className="text-caption font-semibold text-label-tertiary mb-1">Point bas projeté</p>
          <p
            className={`text-body font-bold tabular-nums ${lowestIsSafe ? 'text-gold' : 'text-negative'}`}
          >
            {formatCurrency(forecast.lowestPoint.balance)}
          </p>
          <p className="text-caption text-label-tertiary">{lowestDateFormatted}</p>
        </div>
      </div>

      {/* Bandeau alerte */}
      {breach && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-negative/10 border border-negative/30 px-4 py-4 flex items-start gap-4"
        >
          <AlertTriangle
            size={18}
            className="text-negative flex-shrink-0 mt-1"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-negative">
              {forecast.belowZeroDate ? 'Découvert anticipé le…' : 'Seuil de sécurité franchi le…'}
            </p>
            <p className="text-caption text-negative/70 mt-1 leading-relaxed">
              Solde estimé à{' '}
              <span className="font-serif font-bold">
                {formatCurrency(forecast.lowestPoint.balance)}
              </span>{' '}
              le{' '}
              {new Date(breach).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
              })}
              .
            </p>
          </div>
        </motion.div>
      )}

      {/* Prévisions avant le point bas et entrées */}
      <div className="pt-4 border-t border-separator">
        <Button
          variant="plain"
          size="sm"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full !justify-between !px-0 !min-h-0 py-2 text-left group hover:no-underline"
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2">
            <span className="text-caption font-semibold text-gold/80 group-hover:text-gold transition-colors">
              Détail & entrées
            </span>
            <span className="text-caption px-2 py-1 rounded-full bg-white/[0.05] border border-separator text-label-secondary font-medium">
              {displayedEvents.length} {displayedEvents.length > 1 ? 'opérations' : 'opération'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-caption text-label-tertiary group-hover:text-label-secondary transition-colors">
            <span>{isExpanded ? 'Masquer' : 'Afficher'}</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 text-label-tertiary group-hover:text-gold ${
                isExpanded ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </div>
        </Button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-4"
            >
              {displayedEvents.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {displayedEvents.map((ev, index) => (
                    <div
                      key={`${ev.sourceKey}-${ev.date}-${index}`}
                      className="flex items-center justify-between px-4 py-4 rounded-lg bg-white/[0.01] border border-separator"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {ev.type === 'income' ? (
                          <ArrowUpCircle size={16} className="text-positive flex-shrink-0" />
                        ) : (
                          <ArrowDownCircle size={16} className="text-negative flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p
                            className="text-footnote font-bold text-label truncate"
                            title={ev.label}
                          >
                            {ev.label}
                          </p>
                          <p className="text-caption text-label-tertiary">
                            {new Date(ev.date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-footnote font-serif font-bold tabular-nums ml-4 flex-shrink-0 ${
                          ev.amount < 0 ? 'text-negative' : 'text-positive'
                        }`}
                      >
                        {formatCurrency(ev.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-label-tertiary py-2 text-center">
                  Aucun mouvement planifié avant le point bas.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
