import React from 'react';
import { useIntl, type IntlShape } from 'react-intl';
import type {
  AjustementEstimation,
  BienImmobilier,
  EstimationImmobiliere,
  JustificationEstimation,
} from '../../types/banking.types';
import { fmt } from '../../utils/format';
import { Amount, Badge, Stack, Text } from '../../ui';

interface PropertyValuationBreakdownProps {
  estimation: EstimationImmobiliere & { justification: JustificationEstimation };
  bien: BienImmobilier;
}

/** Part de surface des ventes comparables retenues (voir `SURFACE_COMPARABLE_*` côté Python). */
const SURFACE_MIN = 0.7;
const SURFACE_MAX = 1.3;

const pct = (n: number, digits = 1): string => n.toFixed(digits).replace('.', ',');
const signedPct = (n: number): string => `${n > 0 ? '+' : ''}${pct(n)} %`;
const frDate = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR');

function adjustmentLabel(t: IntlShape['formatMessage'], a: AjustementEstimation): string {
  if (a.code.startsWith('ENERGY_')) {
    return t({ id: 'property.adjustment.ENERGY' }, { classe: a.code.slice('ENERGY_'.length) });
  }
  return t({ id: `property.adjustment.${a.code}` }, { m2: a.m2 ?? 0 });
}

/** Valeur du bien qui motive le coefficient (étage, année…), vide pour un simple équipement. */
function adjustmentValue(t: IntlShape['formatMessage'], a: AjustementEstimation): string | null {
  const v = a.valeurBien;
  if (v === undefined || v === null || typeof v === 'boolean') return null;
  if (a.code === 'EXTRA_BATHROOM') return t({ id: 'property.why.value.bathrooms' }, { v });
  if (a.code === 'GROUND_FLOOR' || a.code === 'NO_ELEVATOR' || a.code === 'TOP_FLOOR_ELEVATOR') {
    return t({ id: 'property.why.value.floor' }, { v });
  }
  if (a.code.startsWith('ERA_')) return t({ id: 'property.why.value.year' }, { v });
  return null;
}

const adjustmentWhy = (t: IntlShape['formatMessage'], a: AjustementEstimation): string =>
  t({ id: a.code.startsWith('ENERGY_') ? 'property.why.ENERGY' : `property.why.${a.code}` });

/**
 * Justification détaillée d'une estimation : prix de référence et ventes comparables,
 * réindexation, chaque coefficient avec son explication, total, fourchette et confiance.
 */
export const PropertyValuationBreakdown: React.FC<PropertyValuationBreakdownProps> = ({
  estimation,
  bien,
}) => {
  const { formatMessage: t } = useIntl();
  const { reference, comparables, reindexation, multiplicateur } = estimation.justification;
  const maison = bien.nature === 'maison';
  const base = reference.prixM2 * bien.surface;
  const nature = t({
    id: maison ? 'property.why.nature.maison' : 'property.why.nature.appartement',
  });

  const referenceText = (() => {
    if (reference.echelle === 'voisinage') {
      return t(
        { id: 'property.why.reference.voisinage' },
        {
          count: reference.echantillon,
          nature,
          min: Math.round(bien.surface * SURFACE_MIN),
          max: Math.round(bien.surface * SURFACE_MAX),
          rayon: reference.rayon ?? 0,
          millesime: reference.millesime,
        },
      );
    }
    return t(
      {
        id:
          reference.echelle === 'departements'
            ? 'property.why.reference.departements'
            : 'property.why.reference.communes',
      },
      { count: reference.echantillon, nature, millesime: reference.millesime },
    );
  })();

  const row = (key: string, label: React.ReactNode, value: React.ReactNode) => (
    <Stack as="li" key={key} direction="row" justify="between" gap="md">
      <Text variant="footnote" tone="secondary">
        {label}
      </Text>
      {value}
    </Stack>
  );

  return (
    <Stack gap="md" data-testid="property-breakdown">
      <Stack gap="xs" as="section" aria-label={t({ id: 'property.why.reference.title' })}>
        <Text variant="subhead">{t({ id: 'property.why.reference.title' })}</Text>
        <Text variant="footnote" tone="secondary">
          {referenceText}
        </Text>
        <Stack as="ul" gap="xs">
          {row(
            'base',
            t(
              { id: 'property.card.how.base' },
              { price: fmt(reference.prixM2), surface: bien.surface },
            ),
            <Text variant="footnote" numeric>
              {fmt(base)}
            </Text>,
          )}
        </Stack>
        {comparables && comparables.length > 0 && (
          <Stack gap="xs">
            <Text variant="caption" tone="tertiary">
              {t({ id: 'property.why.comparables.title' }, { count: comparables.length })}
            </Text>
            <Stack as="ul" gap="xs">
              {comparables.map((c) =>
                row(
                  `${c.date}-${c.distanceM}-${c.surface}-${c.prixM2}`,
                  t(
                    { id: 'property.why.comparables.row' },
                    { date: frDate(c.date), distance: c.distanceM, surface: c.surface },
                  ),
                  <Text variant="footnote" numeric>
                    {t({ id: 'property.why.comparables.price' }, { price: fmt(c.prixM2) })}
                  </Text>,
                ),
              )}
            </Stack>
          </Stack>
        )}
      </Stack>

      <Stack gap="xs" as="section" aria-label={t({ id: 'property.why.reindex.title' })}>
        <Text variant="subhead">{t({ id: 'property.why.reindex.title' })}</Text>
        {reindexation && 'integree' in reindexation ? (
          <>
            <Text variant="footnote" tone="secondary">
              {t({ id: 'property.why.reindex.integree' })}
            </Text>
            <Stack as="ul" gap="xs">
              {Object.entries(reindexation.ratios).map(([annee, ratio]) =>
                row(
                  annee,
                  t({ id: 'property.why.reindex.year' }, { year: annee }),
                  <Text variant="footnote" numeric>
                    × {ratio.toFixed(4).replace('.', ',')}
                  </Text>,
                ),
              )}
            </Stack>
          </>
        ) : reindexation ? (
          <>
            <Text variant="footnote" tone="secondary">
              {t(
                { id: 'property.why.reindex.detail' },
                {
                  from: reindexation.trimestreDepart,
                  fromValue: pct(reindexation.indiceDepart),
                  to: reindexation.trimestreActuel,
                  toValue: pct(reindexation.indiceActuel),
                },
              )}
            </Text>
            <Stack as="ul" gap="xs">
              {row(
                'ratio',
                t({ id: 'property.card.how.reindex' }),
                <Text variant="footnote" numeric>
                  × {reindexation.ratio.toFixed(4).replace('.', ',')}
                </Text>,
              )}
            </Stack>
          </>
        ) : (
          <Text variant="footnote" tone="secondary">
            {t({ id: 'property.card.how.reindex.none' })}
          </Text>
        )}
      </Stack>

      <Stack gap="xs" as="section" aria-label={t({ id: 'property.why.adjustments.title' })}>
        <Text variant="subhead">{t({ id: 'property.why.adjustments.title' })}</Text>
        {estimation.ajustements && estimation.ajustements.length > 0 ? (
          <Stack as="ul" gap="sm">
            {estimation.ajustements.map((a) => {
              const valeur = adjustmentValue(t, a);
              return (
                <Stack as="li" key={a.code} gap="xs">
                  <Stack direction="row" justify="between" gap="md">
                    <Stack direction="row" gap="sm" align="center" wrap>
                      <Text variant="footnote">
                        {adjustmentLabel(t, a)}
                        {valeur && ` · ${valeur}`}
                        {a.facteur !== undefined &&
                          ` (${signedPct((a.facteurApplique ?? a.facteur) * 100)})`}
                      </Text>
                      {a.origine === 'ademe' && (
                        <Badge tone="neutral">{t({ id: 'property.why.origin.ademe' })}</Badge>
                      )}
                    </Stack>
                    <Amount value={a.montant} signed variant="footnote" />
                  </Stack>
                  <Text variant="caption" tone="tertiary">
                    {adjustmentWhy(t, a)}
                  </Text>
                </Stack>
              );
            })}
          </Stack>
        ) : (
          <Text variant="footnote" tone="secondary">
            {t({ id: 'property.why.adjustments.none' })}
          </Text>
        )}
        <Stack as="ul" gap="xs">
          {row(
            'mult',
            t({ id: 'property.card.how.multiplier' }),
            <Text variant="footnote" numeric>
              × {multiplicateur.applique.toFixed(2).replace('.', ',')}
            </Text>,
          )}
        </Stack>
        {multiplicateur.borne && (
          <Text variant="caption" tone="warning">
            {t(
              { id: 'property.why.multiplier.capped' },
              { sum: signedPct(multiplicateur.somme * 100) },
            )}
          </Text>
        )}
        <Text variant="caption" tone="tertiary">
          {t({ id: 'property.why.adjustments.heuristic' })}
        </Text>
      </Stack>

      <Stack gap="xs" as="section" aria-label={t({ id: 'property.why.total.title' })}>
        <Text variant="subhead">{t({ id: 'property.why.total.title' })}</Text>
        <Stack as="ul" gap="xs">
          {row(
            'total',
            t({ id: 'property.card.how.total' }),
            <Amount value={estimation.valeur} variant="footnote" tone="neutral" />,
          )}
        </Stack>
        <Text variant="caption" tone="tertiary">
          {t(
            { id: 'property.why.range' },
            { low: fmt(reference.q25M2), high: fmt(reference.q75M2) },
          )}
        </Text>
      </Stack>

      {estimation.confiance && (
        <Stack gap="xs" as="section" aria-label={t({ id: 'property.why.confidence.title' })}>
          <Text variant="subhead">{t({ id: 'property.why.confidence.title' })}</Text>
          <Text variant="footnote" tone="secondary">
            {t({ id: `property.why.confidence.${estimation.confiance}` })}
          </Text>
        </Stack>
      )}
    </Stack>
  );
};
