import { useMemo } from 'react';
import { usePatrimoine } from './usePatrimoine';
import type { OwnerMapping } from './usePatrimoine';
import type { OwnerScope } from './useWealthScope';
import { Holding } from './usePortfolio';
import { canonicalPortfolioAssetId, makePortfolioDedup } from '../utils/wealthTimeline';

function resolveOwner(
  compte: string,
  directOwner: string | undefined,
  mapping: OwnerMapping,
  isSavings: boolean,
): string {
  if (directOwner) return directOwner;
  if (mapping.accounts[compte]) return mapping.accounts[compte];
  if (isSavings) {
    const patterns = mapping.savings_patterns || {};
    if (patterns[compte]) return patterns[compte];
    const compteLower = compte.toLowerCase();
    for (const [pattern, owner] of Object.entries(patterns)) {
      if (
        pattern.toLowerCase().includes(compteLower) ||
        compteLower.includes(pattern.toLowerCase())
      ) {
        return owner;
      }
    }
  }
  return mapping.default_owner || 'Nicolas';
}

/** Calcule les agrégats patrimoniaux globaux (total, répartition par type/propriétaire). */
export const useWealthAggregates = (
  ownerScope: OwnerScope,
  livePortfolioValue?: number,
  portfolioHoldings: Holding[] = [],
  selectedTypes?: string[],
) => {
  const { placements, savingsBalances, accountBalances, ownerMapping, placementHistory } =
    usePatrimoine();

  const metrics = useMemo(() => {
    // ... assets construction ...
    const effectivePortfolioValue = livePortfolioValue !== undefined ? livePortfolioValue : 0;

    const assets = [
      ...placements.map((p) => ({
        id: p.id,
        name: p.nom,
        ownerId: (p.owner || ownerMapping.default_owner || 'Nicolas').toLowerCase(),
        type: (() => {
          const t = (p.type || '').toLowerCase();
          if (t === 'cash') return 'cash' as const;
          if (t === 'savings' || t === 'epargne') return 'savings' as const;
          if (
            [
              'cto',
              'pea',
              'assurance_vie',
              'portefeuille',
              'market',
              'other',
              'investissements',
              'placements',
            ].includes(t)
          )
            return 'investissements' as const;
          if (t === 'per' || t === 'retirement') return 'retirement' as const;
          return 'investissements' as const;
        })(),
        value: Number(p.montant) || 0,
      })),
      ...savingsBalances.map((b) => ({
        id: b.id || b.compte,
        name: b.compte || b.id,
        ownerId: resolveOwner(b.compte || b.id, b.owner, ownerMapping, true).toLowerCase(),
        type: 'savings' as const,
        value: Number(b.current_balance || b.solde) || 0,
      })),
      ...(accountBalances || []).map((b) => ({
        id: b.id || b.compte,
        name: b.compte || b.id,
        ownerId: resolveOwner(b.compte || b.id, b.owner, ownerMapping, false).toLowerCase(),
        type: 'cash' as const,
        value: Number(b.current_balance || b.solde) || 0,
      })),
    ];

    const hasMarketPlacements = placements.some((p) =>
      ['cto', 'pea', 'assurance_vie', 'per'].includes(p.type),
    );

    // Aggregation du portefeuille live par enveloppe (Compte) et par propriétaire
    const portfolioEnvelopes = new Map<
      string,
      {
        id: string;
        name: string;
        ownerId: string;
        type: 'investissements' | 'retirement';
        value: number;
      }
    >();

    if (portfolioHoldings && Array.isArray(portfolioHoldings)) {
      portfolioHoldings.forEach((h) => {
        if (!h) return;
        const ownerId = (h.owner || 'nicolas').toLowerCase();
        const accountName = h.account || 'Portefeuille Bourse';
        const key = `${accountName}_${ownerId}`.toLowerCase();

        if (!portfolioEnvelopes.has(key)) {
          // Detect if this envelope is a PER/Retirement account
          const isRetirement =
            accountName.toLowerCase().includes('per') ||
            accountName.toLowerCase().includes('retraite');

          portfolioEnvelopes.set(key, {
            id: `live_pf_${key}`,
            name: accountName,
            ownerId: ownerId,
            type: isRetirement ? 'retirement' : ('investissements' as const),
            value: 0,
          });
        }
        portfolioEnvelopes.get(key)!.value += Number(h.currentValue) || 0;
      });

      // Ajouter les enveloppes agrégées aux assets
      portfolioEnvelopes.forEach((env) => assets.push(env));
    } else if (effectivePortfolioValue > 0 && !hasMarketPlacements) {
      // Fallback global si pas de holdings détaillées et pas de placements manuels
      assets.push({
        id: 'portfolio_fallback',
        name: 'Portefeuille Bourse',
        ownerId: 'nicolas',
        type: 'investissements' as const,
        value: effectivePortfolioValue,
      });
    }

    const ownerFilteredAssets =
      ownerScope === 'all'
        ? assets
        : assets.filter((a) => ownerScope.some((s) => s.toLowerCase() === a.ownerId.toLowerCase()));

    // Filter by type if specified
    const filteredAssets =
      selectedTypes && selectedTypes.length > 0
        ? ownerFilteredAssets.filter((a) => selectedTypes.includes(a.type))
        : ownerFilteredAssets;

    const total = filteredAssets.reduce((sum, a) => sum + (a.value || 0), 0);
    const per = filteredAssets
      .filter((a) => a.type === 'retirement')
      .reduce((sum, a) => sum + (a.value || 0), 0);

    // --- Calculation of delta 30d ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimit = thirtyDaysAgo.toISOString().split('T')[0]!;

    // Reconstruct state at T-30d
    const stateAt30d = new Map<string, number>();

    // Process history up to dateLimit
    placementHistory
      .filter((h) => h.date && h.date <= dateLimit)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .forEach((h) => {
        const ownerId = (h.owner || 'nicolas').toLowerCase();

        // Skip if owner doesn't match scope
        if (ownerScope !== 'all' && !ownerScope.some((s) => s.toLowerCase() === ownerId)) return;

        // Canonicalise pour que les backfill mensuels `portfolio_bkfill_*` ne s'additionnent pas.
        const assetId = canonicalPortfolioAssetId(
          h.assetId || h.placementId || `${h.owner}_${h.type}_${h.category}`,
        );
        stateAt30d.set(assetId, Number(h.montant) || 0);
      });

    // Dédup du portefeuille (positions vs agrégats quotidien/legacy) avant de sommer.
    const skipPortfolio30d = makePortfolioDedup(stateAt30d.keys());
    const totalAt30d = Array.from(stateAt30d.entries()).reduce(
      (sum, [assetId, v]) => (skipPortfolio30d(assetId) ? sum : sum + v),
      0,
    );
    const delta30dValue = totalAt30d > 0 ? total - totalAt30d : 0;
    const delta30dPct = totalAt30d > 0 ? (delta30dValue / totalAt30d) * 100 : 0;

    const segments = [
      { type: 'cash', amount: 0, pct: 0 },
      { type: 'savings', amount: 0, pct: 0 },
      { type: 'investissements', amount: 0, pct: 0 },
      { type: 'retirement', amount: 0, pct: 0 },
    ];

    filteredAssets.forEach((a) => {
      const segment = segments.find((s) => s.type === a.type);
      if (segment) segment.amount += a.value || 0;
    });

    segments.forEach((s) => {
      s.pct = total > 0 ? (s.amount / total) * 100 : 0;
    });

    // Répartition par type SANS filtre de type (owner uniquement) : sert d'ancre
    // live à l'évolution du patrimoine, dont les catégories ne sont jamais
    // filtrées par type (le filtre ne fait que masquer des lignes).
    const segmentsAllTypes = segments.map((s) => ({ type: s.type, amount: 0 }));
    ownerFilteredAssets.forEach((a) => {
      const segment = segmentsAllTypes.find((s) => s.type === a.type);
      if (segment) segment.amount += a.value || 0;
    });

    return { total, per, segments, segmentsAllTypes, filteredAssets, delta30dValue, delta30dPct };
  }, [
    placements,
    savingsBalances,
    accountBalances,
    ownerMapping,
    ownerScope,
    livePortfolioValue,
    portfolioHoldings,
    placementHistory,
    selectedTypes,
  ]);

  return metrics;
};
