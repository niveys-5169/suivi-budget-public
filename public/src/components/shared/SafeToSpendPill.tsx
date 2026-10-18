import React, { useState } from 'react';
import { useSafeToSpend } from '../../hooks/useSafeToSpend';
import { formatCurrency } from '../../lib/formatters';
import { Button, Text } from '../../ui';
import { Sparkles, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SafeToSpendPillProps {
  className?: string;
  compact?: boolean;
}

/**
 * Pilule Safe-to-Spend (Reste-à-Vivre Réel) AURUM v3.
 * Affiche en temps réel le montant réellement disponible déduit :
 * - des charges fixes restantes du mois
 * - du reste à dépenser sur les enveloppes budgétaires variables
 * avec le rythme journalier conseillé.
 */
export const SafeToSpendPill: React.FC<SafeToSpendPillProps> = ({
  className = '',
  compact = false,
}) => {
  const {
    safeToSpend,
    dailyPace,
    upcomingIncome,
    upcomingFixedCharges,
    remainingBudgets,
    totalCommitted,
    daysRemainingInMonth,
    hasRecurrences,
    hasBudgets,
  } = useSafeToSpend();

  const [expanded, setExpanded] = useState(false);

  // Si l'utilisateur n'a ni récurrence ni budget configuré, ne pas encombrer
  if (!hasRecurrences && !hasBudgets && totalCommitted === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Button
        variant="plain"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="group flex items-center gap-2 rounded-md bg-gold-subtle border border-separator px-2 py-1 text-label hover:bg-raised"
        aria-expanded={expanded}
        aria-label="Détail du reste à vivre"
      >
        <span className="flex items-center justify-center text-gold">
          <Sparkles size={14} aria-hidden="true" />
        </span>

        <span className="flex items-baseline gap-1">
          <Text variant="caption" tone="secondary">
            Reste à vivre :
          </Text>
          <Text variant="caption" tone="accent" numeric className="font-semibold text-gold">
            {formatCurrency(safeToSpend)}
          </Text>
        </span>

        {!compact && (
          <span className="hidden sm:inline-flex items-center gap-1 border-l border-separator pl-2">
            <Text variant="footnote" tone="tertiary">
              Rythme :
            </Text>
            <Text variant="footnote" tone="positive" numeric className="font-medium">
              ~{formatCurrency(dailyPace)}/j
            </Text>
          </span>
        )}

        <ChevronDown
          size={12}
          className={`text-label-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </Button>

      {/* Accordéon explicatif au clic */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-xs mt-2 overflow-hidden"
          >
            <div className="rounded-lg bg-surface border border-separator p-2 flex flex-col gap-1 text-center">
              {upcomingIncome > 0 && (
                <div className="flex items-center justify-between px-1">
                  <Text variant="footnote" tone="secondary">
                    Salaires & CAF attendus
                  </Text>
                  <Text variant="footnote" tone="positive" numeric className="font-semibold">
                    +{formatCurrency(upcomingIncome)}
                  </Text>
                </div>
              )}
              {upcomingFixedCharges > 0 && (
                <div className="flex items-center justify-between px-1">
                  <Text variant="footnote" tone="secondary">
                    Charges fixes restantes
                  </Text>
                  <Text variant="footnote" tone="negative" numeric className="font-semibold">
                    -{formatCurrency(upcomingFixedCharges)}
                  </Text>
                </div>
              )}
              {remainingBudgets > 0 && (
                <div className="flex items-center justify-between px-1">
                  <Text variant="footnote" tone="secondary">
                    Budgets variables restants
                  </Text>
                  <Text variant="footnote" tone="negative" numeric className="font-semibold">
                    -{formatCurrency(remainingBudgets)}
                  </Text>
                </div>
              )}
              <div className="flex items-center justify-between px-1">
                <Text variant="footnote" tone="secondary">
                  Jours restants
                </Text>
                <Text variant="footnote" tone="primary" numeric>
                  {daysRemainingInMonth} jours
                </Text>
              </div>
              <div className="flex items-center justify-between px-1 border-t border-separator pt-1 mt-1">
                <Text variant="footnote" tone="secondary">
                  Allure conseillée
                </Text>
                <Text variant="footnote" tone="positive" numeric className="font-semibold">
                  {formatCurrency(dailyPace)} / jour
                </Text>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
