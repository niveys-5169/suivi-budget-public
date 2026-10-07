import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useIntl, type IntlShape } from 'react-intl';
import type {
  AjustementEstimation,
  BienImmobilier,
  Credit,
  EstimationImmobiliere,
  ModeValorisation,
} from '../../types/banking.types';
import { capitalRestantDu } from '../../utils/creditSchedule';
import { coutAchat, equiteNette, plusValueLatente } from '../../utils/property';
import { fmt } from '../../utils/format';
import { toast } from '../../lib/toast';
import { triggerGitHubWorkflow } from '../../services/firebase-api';
import { Amount, Badge, Button, Card, Separator, Stack, Text, type BadgeTone } from '../../ui';
import { PropertyValuationBreakdown } from './PropertyValuationBreakdown';

/** Sous-ensemble d'un placement immobilier lu par la carte (compatible avec les deux hooks). */
export interface PropertyValuationPlacement {
  id: string;
  montant: number;
  bien?: BienImmobilier;
  estimation?: EstimationImmobiliere;
  modeValorisation?: ModeValorisation;
}

interface PropertyValuationCardProps {
  placement: PropertyValuationPlacement;
  /** Crédit associé (`placement.creditId`), pour l'équité nette. */
  credit?: Credit;
  /** Date de référence du capital restant dû (aujourd'hui par défaut). */
  today?: Date;
}

const CONFIDENCE_TONE: Record<NonNullable<EstimationImmobiliere['confiance']>, BadgeTone> = {
  faible: 'warning',
  moyenne: 'neutral',
  haute: 'positive',
};

const pct = (n: number, digits = 1): string => n.toFixed(digits).replace('.', ',');
const signedPct = (n: number): string => `${n > 0 ? '+' : ''}${pct(n)} %`;
const frDate = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR');

function adjustmentLabel(t: IntlShape['formatMessage'], a: AjustementEstimation): string {
  if (a.code.startsWith('ENERGY_')) {
    return t({ id: 'property.adjustment.ENERGY' }, { classe: a.code.slice('ENERGY_'.length) });
  }
  return t({ id: `property.adjustment.${a.code}` }, { m2: a.m2 ?? 0 });
}

/**
 * Valorisation d'un bien immobilier : valeur retenue, fourchette, équité nette,
 * plus-value, et le détail de la construction du chiffre (prix DVF au m² ×
 * surface, ajustements heuristiques, réindexation INSEE).
 */
export const PropertyValuationCard: React.FC<PropertyValuationCardProps> = ({
  placement,
  credit,
  today,
}) => {
  const { formatMessage: t } = useIntl();
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = useMemo(() => today ?? new Date(), [today]);

  const { estimation, bien } = placement;
  const retained = Number(placement.montant) || 0;
  const ok = estimation?.statut === 'OK';
  const manual = placement.modeValorisation === 'manuel';

  const reestimate = async () => {
    setBusy(true);
    try {
      const res = (await triggerGitHubWorkflow('estimate-property', {
        placementId: placement.id,
      })) as { error?: string } | null;
      if (res?.error) toast.error(t({ id: 'property.card.reestimate.error' }));
      else toast.success(t({ id: 'property.card.reestimate.sent' }));
    } finally {
      setBusy(false);
    }
  };

  const gain = plusValueLatente(retained, bien);
  const base = ok && estimation.prixM2 && bien ? estimation.prixM2 * bien.surface : null;

  return (
    <Card bordered>
      <Stack gap="md">
        <Stack direction="row" justify="between" align="center">
          <Text variant="title3">{t({ id: 'property.card.title' })}</Text>
          <Button size="sm" variant="secondary" loading={busy} onClick={reestimate}>
            {!busy && <RefreshCw size={14} aria-hidden="true" />}
            {t({ id: 'property.card.reestimate' })}
          </Button>
        </Stack>

        {!estimation && (
          <Text variant="footnote" tone="secondary">
            {t({ id: 'property.card.empty' })}
          </Text>
        )}

        {estimation && !ok && (
          <Text variant="footnote" tone="warning" role="status">
            {t({ id: `property.status.${estimation.statut}` })}
          </Text>
        )}

        {ok && (
          <Stack gap="xs">
            <Text variant="caption" tone="tertiary">
              {t({ id: 'property.card.value' })}
            </Text>
            <Amount value={estimation.valeur} variant="title1" tone="neutral" />
            {estimation.basse !== undefined && estimation.haute !== undefined && (
              <Text variant="footnote" tone="secondary">
                {t(
                  { id: 'property.card.range' },
                  { low: fmt(estimation.basse), high: fmt(estimation.haute) },
                )}
              </Text>
            )}
            <Stack direction="row" gap="sm" align="center" wrap className="pt-2">
              {estimation.confiance && (
                <Badge tone={CONFIDENCE_TONE[estimation.confiance]}>
                  {t({ id: `property.card.confidence.${estimation.confiance}` })}
                </Badge>
              )}
              {estimation.echantillon !== undefined && estimation.millesime && (
                <Text variant="footnote" tone="tertiary">
                  {t(
                    { id: 'property.card.sales' },
                    { count: estimation.echantillon, year: estimation.millesime },
                  )}
                </Text>
              )}
              {estimation.echelle === 'departements' && (
                <Text variant="footnote" tone="warning">
                  {t({ id: 'property.card.scale.departements' })}
                </Text>
              )}
              {estimation.source && (
                <Text variant="footnote" tone="tertiary">
                  {estimation.source === 'dvf-voisinage' && estimation.rayon !== undefined
                    ? t({ id: 'property.card.source.dvf-voisinage' }, { rayon: estimation.rayon })
                    : t({ id: `property.card.source.${estimation.source}` })}
                </Text>
              )}
              {estimation.dpeDetecte?.dpe && (
                <Text variant="footnote" tone="tertiary">
                  {t({ id: 'property.card.dpe.detected' }, { classe: estimation.dpeDetecte.dpe })}
                </Text>
              )}
              <Text variant="footnote" tone="tertiary">
                {t({ id: 'property.card.updated' }, { date: frDate(estimation.date) })}
              </Text>
            </Stack>
          </Stack>
        )}

        {manual && (
          <Text variant="footnote" tone="tertiary">
            {t({ id: 'property.card.manual' })}
          </Text>
        )}

        {(manual || !ok) && retained > 0 && (
          <Stack direction="row" justify="between" align="center">
            <Text variant="callout" tone="secondary">
              {t({ id: 'property.card.retained' })}
            </Text>
            <Amount value={retained} variant="headline" tone="neutral" />
          </Stack>
        )}

        {(credit || gain) && <Separator />}

        {credit && (
          <Stack gap="xs">
            <Stack direction="row" justify="between" align="center">
              <Text variant="callout" tone="secondary">
                {t({ id: 'property.card.equity' })}
              </Text>
              <Amount value={equiteNette(retained, credit, now)} variant="headline" />
            </Stack>
            <Text variant="footnote" tone="tertiary">
              {t(
                { id: 'property.card.equity.debt' },
                { amount: fmt(capitalRestantDu(credit, now)) },
              )}
            </Text>
          </Stack>
        )}

        {gain && (
          <Stack gap="xs">
            <Stack direction="row" justify="between" align="center">
              <Text variant="callout" tone="secondary">
                {t({ id: 'property.card.gain' })}
              </Text>
              <Stack direction="row" gap="sm" align="center">
                <Amount value={gain.montant} signed variant="headline" />
                <Text variant="footnote" tone={gain.montant >= 0 ? 'positive' : 'negative'}>
                  {signedPct(gain.pct)}
                </Text>
              </Stack>
            </Stack>
            <Text variant="footnote" tone="tertiary">
              {t({ id: 'property.card.gain.base' }, { amount: fmt(coutAchat(bien)) })}
            </Text>
          </Stack>
        )}

        {ok && (
          <>
            <Separator />
            <Button
              variant="plain"
              size="sm"
              aria-expanded={showDetail}
              onClick={() => setShowDetail((v) => !v)}
              className="self-start"
            >
              {t({ id: 'property.card.how' })}
            </Button>
            {showDetail && estimation.justification && bien && (
              <PropertyValuationBreakdown
                estimation={{ ...estimation, justification: estimation.justification }}
                bien={bien}
              />
            )}
            {showDetail && !estimation.justification && (
              <Stack gap="sm" as="ul" aria-label={t({ id: 'property.card.how' })}>
                {base !== null && bien && (
                  <Stack as="li" direction="row" justify="between" gap="md">
                    <Text variant="footnote" tone="secondary">
                      {t(
                        { id: 'property.card.how.base' },
                        { price: fmt(estimation.prixM2 ?? 0), surface: bien.surface },
                      )}
                    </Text>
                    <Text variant="footnote" numeric>
                      {fmt(base)}
                    </Text>
                  </Stack>
                )}
                {estimation.ajustements?.map((a) => (
                  <Stack as="li" key={a.code} direction="row" justify="between" gap="md">
                    <Text variant="footnote" tone="secondary">
                      {adjustmentLabel(t, a)}
                      {a.facteur !== undefined && ` (${signedPct(a.facteur * 100)})`}
                    </Text>
                    <Amount value={a.montant} signed variant="footnote" />
                  </Stack>
                ))}
                {estimation.multiplicateur !== undefined && (
                  <Stack as="li" direction="row" justify="between" gap="md">
                    <Text variant="footnote" tone="secondary">
                      {t({ id: 'property.card.how.multiplier' })}
                    </Text>
                    <Text variant="footnote" numeric>
                      × {estimation.multiplicateur.toFixed(2).replace('.', ',')}
                    </Text>
                  </Stack>
                )}
                <Stack as="li" direction="row" justify="between" gap="md">
                  <Text variant="footnote" tone="secondary">
                    {estimation.ratioReindexation !== undefined
                      ? t({ id: 'property.card.how.reindex' })
                      : t({ id: 'property.card.how.reindex.none' })}
                  </Text>
                  {estimation.ratioReindexation !== undefined && (
                    <Text variant="footnote" numeric>
                      × {estimation.ratioReindexation.toFixed(4).replace('.', ',')}
                    </Text>
                  )}
                </Stack>
                <Stack as="li" direction="row" justify="between" gap="md">
                  <Text variant="footnote" tone="primary">
                    {t({ id: 'property.card.how.total' })}
                  </Text>
                  <Amount value={estimation.valeur} variant="footnote" tone="neutral" />
                </Stack>
              </Stack>
            )}
            <Text variant="footnote" tone="tertiary">
              {t({ id: 'property.card.warning' })}
            </Text>
          </>
        )}
      </Stack>
    </Card>
  );
};
