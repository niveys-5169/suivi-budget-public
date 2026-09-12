import React, { useState, useMemo } from 'react';
import { FormattedNumber } from 'react-intl';
import { formatCurrency } from '../../lib/formatters';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  BarChart3,
  ShieldCheck,
  Plus,
  RefreshCw,
  FileUp,
  Filter,
  type LucideIcon,
} from 'lucide-react';
import { MScreenHeader } from '../components/MScreenHeader';
import { MPlacementFormModal } from '../components/MPlacementFormModal';
import { MPositionsImportModal } from '../components/MPositionsImportModal';
import { MPatrimoineFilterModal } from '../components/MPatrimoineFilterModal';
import { MPatrimoineChart } from '../components/MPatrimoineChart';
import { MWealthEvolutionCard } from '../components/MWealthEvolutionCard';
import { AssetDetailModal, type AssetDetailTarget } from '../../components/shared/AssetDetailModal';
import { resolveHoldingAssetId } from '../../utils/historyAssetResolver';
import { MPositionsChart } from '../components/MPositionsChart';
import { useWealthAggregates } from '../../hooks/useWealthAggregates';
import { usePortfolio } from '../../hooks/usePortfolio';
import { usePatrimoine } from '../../hooks/usePatrimoine';
import { usePlacements } from '../../hooks/usePlacements';
import { useWealthScope } from '../../hooks/useWealthScope';
import { useGlobalData } from '../../context/GlobalDataContext';
import { segmentsToLiveByCat, type EvolutionPeriod } from '../../utils/wealthEvolution';

const SEGMENT_LABELS: Record<string, string> = {
  cash: 'Liquidités',
  savings: 'Épargne',
  market: 'Investissements',
  investissements: 'Investissements',
  retirement: 'Retraite',
  other: 'Autres',
};

const SEGMENT_ICONS: Record<string, LucideIcon> = {
  cash: Wallet,
  savings: Landmark,
  market: BarChart3,
  retirement: ShieldCheck,
  other: BarChart3,
};

const CHART_CATEGORY_TO_ASSET_TYPES: Record<string, string[]> = {
  courants: ['cash'],
  epargnelivrets: ['savings'],
  investissements: ['investissements'],
  retraite: ['retirement'],
};

export const PatrimoineScreen: React.FC = () => {
  const { ownerScope, setOwnerScope, wealthTypeScope, setWealthTypeScope } = useWealthScope();
  const { ownerMapping } = useGlobalData();
  const {
    totalValue: livePortfolioValue,
    holdings,
    loading: portfolioLoading,
    login,
    refresh,
    user: portfolioUser,
    error: portfolioError,
    txLoading: portfolioTxLoading,
    fetchTransactions: fetchPortfolioTransactions,
  } = usePortfolio();
  const { placements, refresh: refreshPlacements } = usePlacements();
  const { placementHistory, patrimoineSnapshots } = usePatrimoine();
  const [editingPlacement, setEditingPlacement] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<AssetDetailTarget | null>(null);
  // Période unique pour toute la section Évolution (tableau + charts) — avant,
  // trois sélecteurs indépendants affichaient des fenêtres différentes.
  const [wealthPeriod, setWealthPeriod] = useState<EvolutionPeriod>('1Y');

  // Map UI types to internal types for useWealthAggregates
  const internalSelectedTypes = useMemo(() => {
    if (wealthTypeScope === 'all' || !wealthTypeScope || wealthTypeScope.length === 0)
      return undefined;
    return (wealthTypeScope as string[]).flatMap((ct) => CHART_CATEGORY_TO_ASSET_TYPES[ct] || []);
  }, [wealthTypeScope]);

  const { total, segments, segmentsAllTypes, filteredAssets, delta30dValue, delta30dPct } =
    useWealthAggregates(ownerScope, livePortfolioValue, holdings, internalSelectedTypes);

  // Ancre live de l'évolution : mêmes valeurs que les Allocations (owner-filtré,
  // jamais type-filtré) pour que la valeur « Fin » colle à l'état courant.
  // Tant que le portefeuille live charge encore, segmentsAllTypes sous-estime les
  // investissements (holdings vides) : ancrer dessus ferait chuter artificiellement
  // le dernier jour. On garde le dernier snapshot connu jusqu'à la fin du chargement.
  const liveByCat = useMemo(
    () => (portfolioLoading ? undefined : segmentsToLiveByCat(segmentsAllTypes)),
    [segmentsAllTypes, portfolioLoading],
  );

  const owners = useMemo(() => {
    return (ownerMapping.owners || []).filter((o) => o.toLowerCase() !== 'commun');
  }, [ownerMapping.owners]);

  const isPositive = delta30dValue >= 0;

  const getEditingPlacementData = () => {
    if (!editingPlacement) return undefined;
    const placement = placements.find((p) => p.id === editingPlacement);
    return placement
      ? {
          id: placement.id,
          nom: placement.nom,
          type: placement.type,
          montant: placement.montant,
          owner: placement.owner,
        }
      : undefined;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MScreenHeader
        title="Patrimoine"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="w-11 h-11 flex items-center justify-center text-label-secondary active:text-white"
              title="Importer historique Excel"
            >
              <FileUp size={22} />
            </button>
            <button
              onClick={() => setShowFilterModal(true)}
              className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${
                ownerScope !== 'all' || wealthTypeScope !== 'all'
                  ? 'bg-gold/10 text-gold border border-gold/20'
                  : 'text-label-secondary active:text-white'
              }`}
              title="Filtrer"
            >
              <Filter size={22} />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto pb-12">
        {/* Hero Valeur Nette */}
        <section className="px-4 py-8 flex flex-col items-center justify-center text-center relative">
          <span className="text-caption font-bold text-label-tertiary mb-1">
            Valeur nette totale
          </span>
          <h2 className="text-display font-bold tracking-tight text-white flex items-center">
            <FormattedNumber value={total} style="currency" currency="EUR" />
          </h2>
          <div
            className={`mt-4 px-4 py-1 rounded-full flex items-center gap-1 ${isPositive ? 'bg-positive/10' : 'bg-negative/10'}`}
          >
            {isPositive ? (
              <TrendingUp size={14} className="text-positive" />
            ) : (
              <TrendingDown size={14} className="text-negative" />
            )}
            <span
              className={`text-footnote font-bold ${isPositive ? 'text-positive' : 'text-negative'}`}
            >
              {isPositive ? '+' : ''}
              <FormattedNumber value={delta30dValue} style="currency" currency="EUR" /> (
              {delta30dPct.toFixed(1)}
              %)
            </span>
          </div>
        </section>

        {/* Allocation Cards */}
        <section className="px-4 space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-caption font-bold tracking-normal text-label-tertiary">
              Allocations
            </h3>
            <button
              onClick={() => setEditingPlacement('_new')}
              className="w-11 h-11 bg-gold/10 text-gold rounded-lg flex items-center justify-center hover:bg-gold/20 transition-colors"
              title="Ajouter un placement"
            >
              <Plus size={16} />
            </button>
          </div>
          {segments
            .filter((s) => s.amount > 0)
            .map((segment) => {
              const Icon = SEGMENT_ICONS[segment.type] || BarChart3;
              const isExpanded = expandedSegment === segment.type;
              const segmentAssets = filteredAssets
                .filter((a) => a.type === segment.type)
                .sort((a, b) => b.value - a.value);
              return (
                <div
                  key={segment.type}
                  className="bg-surface border border-separator rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedSegment(isExpanded ? null : segment.type)}
                    aria-expanded={isExpanded}
                    className="w-full text-left p-4 flex items-center gap-4 hover:bg-surface transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold flex-shrink-0">
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-footnote font-bold text-label-tertiary">
                        {SEGMENT_LABELS[segment.type]}
                      </p>
                      <p className="text-title2 font-bold text-white tabular-nums">
                        <FormattedNumber value={segment.amount} style="currency" currency="EUR" />
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-headline font-bold text-gold/60">
                        {Math.round(segment.pct)}%
                      </p>
                    </div>
                  </button>
                  {isExpanded && segmentAssets.length > 0 && (
                    <div className="border-t border-separator divide-y divide-separator">
                      {segmentAssets.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() =>
                            setDetailTarget({
                              kind: 'asset',
                              id: asset.id,
                              name: asset.name,
                              owner: asset.ownerId,
                              type: asset.type,
                              currentValue: asset.value,
                            })
                          }
                          className="w-full min-h-[44px] px-4 py-2 flex items-center justify-between gap-4 text-left hover:bg-surface transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-footnote font-medium text-label-secondary truncate">
                              {asset.name}
                            </p>
                            <p className="text-caption text-label-tertiary tracking-wide">
                              {asset.ownerId}
                            </p>
                          </div>
                          <span className="text-footnote font-bold tabular-nums text-white flex-shrink-0">
                            {formatCurrency(asset.value, 'EUR', 'fr-FR', {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </section>

        {/* Patrimoine evolution chart */}
        <section className="mt-8 px-4 space-y-4">
          <h3 className="text-caption font-bold tracking-normal text-label-tertiary px-1">
            Évolution du patrimoine
          </h3>
          <MWealthEvolutionCard
            history={placementHistory}
            ownerScope={ownerScope}
            wealthTypeScope={wealthTypeScope}
            period={wealthPeriod}
            onPeriodChange={setWealthPeriod}
            liveByCat={liveByCat}
          />
          <div className="bg-surface border border-separator rounded-lg p-4">
            <MPatrimoineChart
              placementHistory={placementHistory}
              patrimoineSnapshots={patrimoineSnapshots}
              period={wealthPeriod}
              ownerScope={ownerScope}
              wealthTypeScope={wealthTypeScope}
            />
          </div>
        </section>

        {/* Positions dans le temps */}
        {placementHistory.length > 0 && (
          <section className="mt-6 px-4">
            <h3 className="text-caption font-bold tracking-normal text-label-tertiary mb-4 px-1">
              Positions dans le temps
            </h3>
            <div className="bg-surface border border-separator rounded-lg p-4">
              <MPositionsChart placementHistory={placementHistory} period={wealthPeriod} />
            </div>
          </section>
        )}

        {/* Portefeuille boursier */}
        <section className="mt-6 px-4 pb-4">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-caption font-bold tracking-normal text-label-tertiary">
              Portefeuille boursier
            </h3>
            {portfolioUser && (
              <button
                onClick={refresh}
                className={`w-11 h-11 rounded-lg bg-surface border border-separator flex items-center justify-center text-white/40 hover:text-gold transition-colors ${portfolioLoading ? 'animate-spin text-gold' : ''}`}
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>

          {!portfolioUser && !portfolioLoading && (
            <button
              onClick={login}
              className="w-full flex items-center justify-between px-4 py-4 rounded-lg bg-gold/5 border border-gold/20 hover:bg-gold/10 transition-all"
            >
              <div className="flex items-center gap-4">
                <BarChart3 size={16} className="text-gold/60" />
                <div className="text-left">
                  <p className="text-footnote font-bold text-gold/80">SuiviPortefeuille</p>
                  <p className="text-caption text-white/30 mt-1">
                    {portfolioError ? `Erreur : ${portfolioError}` : 'Connecter le portefeuille'}
                  </p>
                </div>
              </div>
              <span className="text-footnote font-semibold text-gold/60">→</span>
            </button>
          )}

          {portfolioUser && holdings.length > 0 && (
            <div className="space-y-2">
              {holdings
                .slice()
                .sort((a, b) => b.currentValue - a.currentValue)
                .map((h) => (
                  <button
                    key={`${h.isin}_${h.account}_${h.owner}`}
                    onClick={() =>
                      setDetailTarget({
                        kind: 'holding',
                        id: resolveHoldingAssetId({
                          isin: h.isin,
                          owner: h.owner,
                          account: h.account,
                        }),
                        name: h.name,
                        owner: h.owner,
                        type: 'investissements',
                        currentValue: h.currentValue,
                        isin: h.isin,
                        account: h.account,
                      })
                    }
                    className="w-full text-left flex items-center justify-between px-4 py-4 bg-surface border border-separator rounded-xl hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-footnote font-bold text-white truncate">{h.name}</p>
                      <p className="text-caption text-label-tertiary tracking-wide mt-1">
                        {h.ticker} · {h.quantity} parts
                        {h.owner ? ` · ${h.owner}` : ''}
                      </p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-footnote font-bold tabular-nums text-white">
                        {formatCurrency(h.currentValue, 'EUR', 'fr-FR', {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                      <p
                        className={`text-caption font-bold tabular-nums ${h.unrealizedGain >= 0 ? 'text-positive' : 'text-negative'}`}
                      >
                        {h.unrealizedGain >= 0 ? '+' : ''}
                        {h.unrealizedGainPct.toFixed(1)}%
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          )}

          {portfolioUser && portfolioLoading && (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-gold/10 border-t-gold rounded-full animate-spin" />
            </div>
          )}
        </section>
      </div>

      <AssetDetailModal
        isOpen={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        target={detailTarget}
        placementHistory={placementHistory}
        portfolio={{
          connected: !!portfolioUser,
          login,
          txLoading: portfolioTxLoading,
          fetchTransactions: fetchPortfolioTransactions,
        }}
        onEdit={
          detailTarget && placements.some((p) => p.id === detailTarget.id)
            ? (target) => {
                setDetailTarget(null);
                setEditingPlacement(target.id);
              }
            : undefined
        }
      />

      {editingPlacement && (
        <MPlacementFormModal
          placement={editingPlacement === '_new' ? undefined : getEditingPlacementData()}
          onClose={() => setEditingPlacement(null)}
          onSave={() => {
            setEditingPlacement(null);
            refreshPlacements();
          }}
        />
      )}

      {showImportModal && (
        <MPositionsImportModal
          existingHistory={placementHistory}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showFilterModal && (
        <MPatrimoineFilterModal
          isOpen={showFilterModal}
          owners={owners}
          ownerScope={ownerScope}
          onChangeOwner={setOwnerScope}
          wealthTypeScope={wealthTypeScope}
          onChangeType={setWealthTypeScope}
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </div>
  );
};
