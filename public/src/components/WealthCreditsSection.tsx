import React, { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { motion } from 'framer-motion';
import { Landmark, Plus } from 'lucide-react';
import type { Credit } from '../types/banking.types';
import {
  anneeCouverture,
  capitalRestantDu,
  couverture,
  dateFin,
  liberationsParAnnee,
  mensualitesEnCours,
  paiementMensuel,
} from '../utils/creditSchedule';
import { fmt } from '../utils/format';
import { Card } from './shared/Card';
import { Button } from './shared/Button';
import { ProgressBar, Text } from '../ui';

interface WealthCreditsSectionProps {
  credits: Credit[];
  /** Total brut du patrimoine (`WealthTotalCard`), avant déduction des dettes. */
  totalPatrimoine: number;
  cashAmount: number;
  savingsAmount: number;
  /** Investissements hors PER (le PER est bloqué, exclu du mobilisable). */
  investAmount: number;
  /** Taux d'endettement du foyer, indépendant du filtre propriétaire (`null` si revenus inconnus). */
  tauxEndettementFoyer: number | null;
  onAddCredit: () => void;
  onEditCredit: (credit: Credit) => void;
}

const formatDate = (date: Date): string => date.toLocaleDateString('fr-FR');

export const WealthCreditsSection: React.FC<WealthCreditsSectionProps> = ({
  credits,
  totalPatrimoine,
  cashAmount,
  savingsAmount,
  investAmount,
  tauxEndettementFoyer: debtRatio,
  onAddCredit,
  onEditCredit,
}) => {
  const { formatMessage: t } = useIntl();
  const today = useMemo(() => new Date(), []);

  const totalCrd = useMemo(
    () => credits.reduce((sum, c) => sum + capitalRestantDu(c, today), 0),
    [credits, today],
  );
  const totalMonthly = useMemo(() => mensualitesEnCours(credits, today), [credits, today]);
  const netWorth = totalPatrimoine - totalCrd;

  const timeline = useMemo(() => liberationsParAnnee(credits, today), [credits, today]);

  const liquidActifs = cashAmount + savingsAmount;
  const mobilisableActifs = liquidActifs + investAmount;
  const liquidCoverage = couverture(liquidActifs, totalCrd);
  const mobilisableCoverage = couverture(mobilisableActifs, totalCrd);
  const coverageYear = useMemo(
    () => (totalCrd > 0 ? anneeCouverture(credits, liquidActifs, today) : null),
    [credits, liquidActifs, totalCrd, today],
  );

  return (
    <section className="px-2 md:px-4 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-xl bg-surface border border-separator text-label-secondary">
            <Landmark size={24} aria-hidden="true" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            {t({ id: 'wealth.credits.title' })}{' '}
            <span className="text-label-tertiary font-light">
              {t({ id: 'wealth.credits.title.emphasis' })}
            </span>
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onAddCredit}>
          <Plus size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{t({ id: 'wealth.credits.action.add' })}</span>
        </Button>
      </div>

      {credits.length === 0 ? (
        <Card variant="subtle" padding="lg" className="text-center">
          <Text variant="body" tone="secondary">
            {t({ id: 'wealth.credits.empty' })}
          </Text>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Card variant="subtle" padding="lg" className="space-y-2">
              <Text variant="caption" tone="tertiary">
                {t({ id: 'wealth.credits.kpi.crd' })}
              </Text>
              <p className="font-serif text-2xl font-semibold text-white tabular-nums">
                {fmt(totalCrd)}
              </p>
            </Card>
            <Card variant="subtle" padding="lg" className="space-y-2">
              <Text variant="caption" tone="tertiary">
                {t({ id: 'wealth.credits.kpi.net' })}
              </Text>
              <p className="font-serif text-2xl font-semibold text-white tabular-nums">
                {fmt(netWorth)}
              </p>
            </Card>
            <Card variant="subtle" padding="lg" className="space-y-2">
              <Text variant="caption" tone="tertiary">
                {t({ id: 'wealth.credits.kpi.monthly' })}
              </Text>
              <p className="font-serif text-2xl font-semibold text-white tabular-nums">
                {fmt(totalMonthly)}
              </p>
            </Card>
            <Card variant="subtle" padding="lg" className="space-y-2">
              <Text variant="caption" tone="tertiary">
                {t({ id: 'wealth.credits.kpi.debtRatio' })}
              </Text>
              <p className="font-serif text-2xl font-semibold text-white tabular-nums">
                {debtRatio === null
                  ? t({ id: 'wealth.credits.kpi.debtRatio.unavailable' })
                  : `${Math.round(debtRatio * 100)} %`}
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            {credits.map((credit) => {
              const crd = capitalRestantDu(credit, today);
              const progress = credit.capitalInitial > 0 ? 1 - crd / credit.capitalInitial : 0;
              return (
                <motion.button
                  key={credit.id}
                  type="button"
                  onClick={() => onEditCredit(credit)}
                  className="w-full text-left p-6 rounded-xl bg-raised border border-separator hover:border-white/15 transition-all space-y-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Text variant="headline" tone="primary">
                      {credit.nom}
                    </Text>
                    <Text variant="footnote" tone="secondary">
                      {t(
                        { id: 'wealth.credits.list.monthly' },
                        { amount: fmt(paiementMensuel(credit)) },
                      )}
                    </Text>
                  </div>
                  <ProgressBar
                    value={progress}
                    tone="accent"
                    label={t(
                      { id: 'wealth.credits.list.progress' },
                      { pct: Math.round(progress * 100) },
                    )}
                  />
                  <div className="flex items-center justify-between gap-4">
                    <Text variant="footnote" tone="tertiary">
                      {t({ id: 'wealth.credits.list.remaining' }, { amount: fmt(crd) })}
                    </Text>
                    <Text variant="footnote" tone="tertiary">
                      {t({ id: 'wealth.credits.list.end' }, { date: formatDate(dateFin(credit)) })}
                    </Text>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <Card variant="subtle" padding="lg" className="space-y-4">
            <Text variant="title3" tone="primary">
              {t({ id: 'wealth.credits.timeline.title' })}
            </Text>
            {timeline.length === 0 ? (
              <Text variant="footnote" tone="tertiary">
                {t({ id: 'wealth.credits.timeline.empty' })}
              </Text>
            ) : (
              <ul className="space-y-2">
                {timeline.map((entry) => {
                  const crdFinAnnee = credits.reduce(
                    (sum, c) => sum + capitalRestantDu(c, new Date(entry.annee, 11, 31)),
                    0,
                  );
                  return (
                    <li key={entry.annee} className="space-y-1">
                      <Text variant="subhead" tone="primary">
                        {entry.annee} — {entry.creditsTermines.join(' + ')}{' '}
                        {t({ id: 'wealth.credits.timeline.ended' })} → +
                        {fmt(entry.mensualiteLiberee)}{' '}
                        {t({ id: 'wealth.credits.timeline.perMonth' })}
                      </Text>
                      <Text variant="footnote" tone="tertiary">
                        {t({ id: 'wealth.credits.timeline.crdEndLabel' })} {entry.annee} :{' '}
                        {fmt(crdFinAnnee)}
                      </Text>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {totalCrd > 0 && (
            <Card variant="subtle" padding="lg" className="space-y-6">
              <Text variant="title3" tone="primary">
                {t({ id: 'wealth.credits.coverage.title' })}
              </Text>

              {liquidCoverage && (
                <div className="space-y-2">
                  <Text variant="footnote" tone="secondary">
                    {t(
                      { id: 'wealth.credits.coverage.line' },
                      {
                        level: t({ id: 'wealth.credits.coverage.liquid' }).toLowerCase(),
                        pct: Math.round(liquidCoverage.ratio * 100),
                        surplus: fmt(liquidCoverage.surplus),
                      },
                    )}
                  </Text>
                  <ProgressBar
                    value={liquidCoverage.ratio}
                    tone={liquidCoverage.ratio >= 1 ? 'accent' : 'negative'}
                    label={t({ id: 'wealth.credits.coverage.liquid' })}
                  />
                  {coverageYear !== null && (
                    <Text variant="footnote" tone="tertiary">
                      {t({ id: 'wealth.credits.coverage.projection' }, { year: coverageYear })}
                    </Text>
                  )}
                </div>
              )}

              {mobilisableCoverage && (
                <div className="space-y-2">
                  <Text variant="footnote" tone="secondary">
                    {t(
                      { id: 'wealth.credits.coverage.line' },
                      {
                        level: t({ id: 'wealth.credits.coverage.mobilisable' }).toLowerCase(),
                        pct: Math.round(mobilisableCoverage.ratio * 100),
                        surplus: fmt(mobilisableCoverage.surplus),
                      },
                    )}
                  </Text>
                  <ProgressBar
                    value={mobilisableCoverage.ratio}
                    tone={mobilisableCoverage.ratio >= 1 ? 'accent' : 'negative'}
                    label={t({ id: 'wealth.credits.coverage.mobilisable' })}
                  />
                </div>
              )}

              <Text variant="footnote" tone="tertiary">
                {t({ id: 'wealth.credits.coverage.noRealEstate' })}
              </Text>
            </Card>
          )}
        </>
      )}
    </section>
  );
};
