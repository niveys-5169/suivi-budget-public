import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { AnimatePresence } from 'framer-motion';
import { useWealthScope } from '../hooks/useWealthScope';
import { useWealthAggregates } from '../hooks/useWealthAggregates';
import { usePatrimoine } from '../hooks/usePatrimoine';
import { usePortfolio } from '../hooks/usePortfolio';
import {
  getLastPlacementSnapshot,
  type Placement,
  type LegacyPlacementFields,
} from '../hooks/usePlacements';
import type { PlacementSnapshot } from '../types/patrimoine';
import { OwnerScopeToggle } from './OwnerScopeToggle';
import { WealthTotalCard } from './WealthTotalCard';
import { WealthAllocationBars } from './WealthAllocationBars';
import { WealthAccountsList } from './WealthAccountsList';
import { WealthPortfolioTable } from './WealthPortfolioTable';
import { WealthEvolutionBudgetChart } from './WealthEvolutionBudgetChart';
import { WealthEvolutionTable } from './WealthEvolutionTable';
import { WealthPositionsChart } from './WealthPositionsChart';
import { PlacementFormModal } from './PlacementFormModal';
import { AssetDetailModal, type AssetDetailTarget } from './shared/AssetDetailModal';
import { resolveHoldingAssetId } from '../utils/historyAssetResolver';
import { hideLoader } from '../utils/loader';
import { PlacementSnapshotModal } from './dashboard/v2/PlacementSnapshotModal';
import { HistoryManagementModal } from './dashboard/v2/HistoryManagementModal';
import {
  LayoutPanelTop,
  Wallet,
  Landmark,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Plus,
  Clock,
  History,
  DatabaseZap,
} from 'lucide-react';
import { fmt } from '../utils/format';
import { buildSnapshotOptions } from '../utils/wealthSnapshot';
import { segmentsToLiveByCat } from '../utils/wealthEvolution';

import { PageHeader } from './shared/PageHeader';
import { Card } from './shared/Card';
import { Button } from './shared/Button';
import { Skeleton } from './shared/Skeleton';
import { AuditExportButton } from './dashboard/v2/AuditExportButton';
import { AuditImportButton } from './dashboard/v2/AuditImportButton';
import { PositionsImportModal } from './dashboard/v2/PositionsImportModal';

type CategoryKey = 'courants' | 'epargnelivrets' | 'investissements' | 'retraite';

const CHART_CATEGORY_TO_ASSET_TYPES: Record<CategoryKey, string[]> = {
  courants: ['cash'],
  epargnelivrets: ['savings'],
  investissements: ['investissements'],
  retraite: ['retirement'],
};

export const WealthPage: React.FC = () => {
  const { formatMessage: t } = useIntl();
  const { ownerScope, setOwnerScope, wealthTypeScope, setWealthTypeScope } = useWealthScope();
  const {
    holdings: portfolioHoldings,
    totalValue: livePortfolioValue,
    loading: portfolioLoading,
    backfilling: portfolioBackfilling,
    backfillResult,
    refresh: refreshPortfolio,
    backfillHistory,
    user: portfolioUser,
    error: portfolioError,
    login: portfolioLogin,
    txLoading: portfolioTxLoading,
    fetchTransactions: fetchPortfolioTransactions,
  } = usePortfolio();

  // Map CHART types to INTERNAL types for useWealthAggregates
  const internalSelectedTypes = useMemo(() => {
    if (wealthTypeScope === 'all' || !wealthTypeScope || wealthTypeScope.length === 0)
      return undefined;
    return (wealthTypeScope as CategoryKey[]).flatMap(
      (ct) => CHART_CATEGORY_TO_ASSET_TYPES[ct] || [],
    );
  }, [wealthTypeScope]);

  const { total, per, segments, segmentsAllTypes, filteredAssets, delta30dValue, delta30dPct } =
    useWealthAggregates(ownerScope, livePortfolioValue, portfolioHoldings, internalSelectedTypes);

  // Ancre live de l'évolution : mêmes valeurs que les Allocations (owner-filtré,
  // jamais type-filtré) pour que la colonne « Fin » colle à l'état courant.
  // Tant que le portefeuille live charge encore, segmentsAllTypes sous-estime les
  // investissements (holdings vides) : ancrer dessus ferait chuter artificiellement
  // le dernier jour. On garde le dernier snapshot connu jusqu'à la fin du chargement.
  const liveByCat = useMemo(
    () => (portfolioLoading ? undefined : segmentsToLiveByCat(segmentsAllTypes)),
    [segmentsAllTypes, portfolioLoading],
  );

  const { loading, ownerMapping, placementHistory, placements, savingsBalances, accountBalances } =
    usePatrimoine();

  const [selectedAsset, setSelectedAsset] = useState<
    (Placement & Partial<LegacyPlacementFields>) | null
  >(null);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AssetDetailTarget | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const snapshotOptions = useMemo(
    () => buildSnapshotOptions(accountBalances, savingsBalances, placements, ownerMapping),
    [accountBalances, savingsBalances, placements, ownerMapping],
  );
  const [previousAmount, setPreviousAmount] = useState<PlacementSnapshot | null>(null);

  // Sync chart owners with global ownerScope
  const chartSelectedOwners = useMemo(() => {
    return ownerScope === 'all' ? [] : (ownerScope as string[]);
  }, [ownerScope]);

  const handleChartOwnersChange = useCallback(
    (owners: string[]) => {
      if (owners.length === 0) {
        setOwnerScope('all');
      } else {
        setOwnerScope(owners);
      }
    },
    [setOwnerScope],
  );

  useEffect(() => {
    if (
      selectedAsset &&
      !selectedAsset.id?.startsWith('live_pf_') &&
      !selectedAsset.id?.startsWith('portfolio')
    ) {
      getLastPlacementSnapshot(selectedAsset.id)
        .then((result) => {
          setPreviousAmount(result);
        })
        .catch((err) => {
          console.error('Error fetching placement snapshot:', err);
          setPreviousAmount(null);
        });
    } else {
      setPreviousAmount(null);
    }
  }, [selectedAsset]);

  useEffect(() => {
    if (!loading) hideLoader();
  }, [loading]);

  const displayedAssets = useMemo(() => {
    return filteredAssets;
  }, [filteredAssets]);

  const chartOwners = useMemo(() => {
    const all = [
      ...(ownerMapping?.owners || []),
      ...placementHistory.map((h) => h.owner || '(sans propriétaire)'),
    ];
    const seen = new Set<string>();
    return all.filter((o) => {
      if (!o) return false;
      const key = o.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [ownerMapping, placementHistory]);

  const handleChartTypesChange = useCallback(
    (types: CategoryKey[]) => setWealthTypeScope(types),
    [setWealthTypeScope],
  );

  if (loading)
    return (
      <div className="pt-6 md:pt-12 px-4 md:px-6 space-y-8" aria-busy="true">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-12 w-64 rounded-lg" />
        </div>
        <Skeleton className="h-44 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );

  const cashAmount = segments.find((s) => s.type === 'cash')?.amount || 0;
  const savingsAmount = segments.find((s) => s.type === 'savings')?.amount || 0;
  const marketAmount = segments.find((s) => s.type === 'investissements')?.amount || 0;

  const dynamicOwners = [
    { id: 'all', label: 'Tous' },
    { id: 'nicolas', label: 'Nicolas' },
    { id: 'sienna', label: 'Sienna' },
    { id: 'romane', label: 'Romane' },
    { id: 'gwen', label: 'Gwen' },
  ];

  return (
    <div className="pt-6 md:pt-12 min-h-screen">
      <PageHeader
        title={t({ id: 'wealth.page.title' })}
        subtitle={t({ id: 'wealth.page.title.emphasis' })}
        rightActions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowHistoryModal(true)}>
              <History size={16} aria-hidden="true" />
              <span className="hidden sm:inline">{t({ id: 'wealth.action.history' })}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowSnapshotModal(true)}>
              <Clock size={16} aria-hidden="true" />
              <span className="hidden sm:inline">{t({ id: 'wealth.action.snapshot' })}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex"
              onClick={() => setIsAddingAsset(true)}
            >
              <Plus size={16} aria-hidden="true" />
              {t({ id: 'wealth.action.addAsset' })}
            </Button>
            <OwnerScopeToggle
              mode={ownerScope === 'all' ? 'all' : 'custom'}
              selectedOwnerIds={ownerScope === 'all' ? [] : ownerScope}
              onChange={(mode, ids) => setOwnerScope(mode === 'all' ? 'all' : ids)}
              owners={dynamicOwners}
            />
          </>
        }
      />

      <div className="flex items-center justify-end gap-2 px-4 md:px-6 py-4 border-b border-separator">
        <AuditExportButton placementHistory={placementHistory} />
        <AuditImportButton onClick={() => setShowImportModal(true)} />
      </div>

      <div className="space-y-12 md:space-y-20 py-8 md:py-12">
        <div className="space-y-8">
          <WealthTotalCard
            total={total}
            per={per}
            delta30dValue={delta30dValue}
            delta30dPct={delta30dPct}
            updatedAt={new Date().toLocaleDateString()}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2 md:px-0">
            <Card
              variant="subtle"
              padding="lg"
              className="flex flex-col items-center gap-4 text-center group hover:bg-white/5 transition-colors"
            >
              <div className="p-4 rounded-xl bg-gold/10 text-gold group-hover:scale-110 transition-transform">
                <Wallet size={20} aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <span className="text-caption font-semibold text-label-tertiary">
                  {t({ id: 'wealth.kpi.cash' })}
                </span>
                <p className="font-serif text-2xl font-semibold text-white tabular-nums">
                  {fmt(cashAmount)}
                </p>
              </div>
            </Card>

            <Card
              variant="subtle"
              padding="lg"
              className="flex flex-col items-center gap-4 text-center group hover:bg-white/5 transition-colors"
            >
              <div className="p-4 rounded-xl bg-surface border border-separator text-label-secondary group-hover:scale-110 group-hover:text-white transition-all">
                <Landmark size={20} aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <span className="text-caption font-semibold text-label-tertiary">
                  {t({ id: 'wealth.kpi.savings' })}
                </span>
                <p className="font-serif text-2xl font-semibold text-white tabular-nums">
                  {fmt(savingsAmount)}
                </p>
              </div>
            </Card>

            <Card
              variant="subtle"
              padding="lg"
              className="flex flex-col items-center gap-4 text-center group hover:bg-white/5 transition-colors"
            >
              <div className="p-4 rounded-xl bg-surface border border-separator text-label-secondary group-hover:scale-110 group-hover:text-white transition-all">
                <TrendingUp size={20} aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <span className="text-caption font-semibold text-label-tertiary">
                  {t({ id: 'wealth.kpi.investments' })}
                </span>
                <p className="font-serif text-2xl font-semibold text-white tabular-nums">
                  {fmt(marketAmount)}
                </p>
              </div>
            </Card>
          </div>
        </div>

        <section className="px-2 md:px-4">
          <WealthEvolutionTable
            history={placementHistory}
            ownerScope={ownerScope}
            wealthTypeScope={wealthTypeScope}
            liveByCat={liveByCat}
          />
        </section>

        <section className="px-2 md:px-4">
          <WealthEvolutionBudgetChart
            history={placementHistory}
            owners={chartOwners}
            selectedOwners={chartSelectedOwners}
            onOwnersChange={handleChartOwnersChange}
            selectedTypes={wealthTypeScope === 'all' ? [] : (wealthTypeScope as CategoryKey[])}
            onTypesChange={handleChartTypesChange}
          />
        </section>

        <section className="px-2 md:px-4">
          <div className="rounded-xl border border-separator bg-surface p-4 md:p-6 space-y-4">
            <h2 className="text-sm md:text-base font-semibold text-white/80">
              Positions dans le Temps
            </h2>
            <WealthPositionsChart placementHistory={placementHistory} />
          </div>
        </section>

        <section className="px-2 md:px-4 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-surface border border-separator text-label-secondary">
                <LayoutPanelTop size={24} aria-hidden="true" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                {t({ id: 'wealth.accounts.title' })}{' '}
                <span className="text-label-tertiary font-light">
                  {t({ id: 'wealth.accounts.title.emphasis' })}
                </span>
              </h2>
            </div>
            <Button
              variant="icon"
              size="sm"
              onClick={() => setIsAddingAsset(true)}
              aria-label={t({ id: 'wealth.action.addAsset' })}
              className="md:hidden"
            >
              <Plus size={20} aria-hidden="true" />
            </Button>
          </div>
          <WealthAccountsList
            rows={displayedAssets.map((a) => ({
              id: a.id,
              name: a.name,
              ownerId: a.ownerId,
              type: a.type,
              balance: a.value,
            }))}
            onOpenAsset={(id) => {
              const asset = filteredAssets.find((a) => a.id === id);
              if (asset) {
                setDetailTarget({
                  kind: 'asset',
                  id: asset.id,
                  name: asset.name,
                  owner: asset.ownerId,
                  type: asset.type,
                  currentValue: asset.value,
                });
              }
            }}
          />
        </section>

        <section className="space-y-8">
          <div className="flex items-center gap-4 px-2 md:px-4">
            <div className="p-4 rounded-xl bg-surface border border-separator text-label-secondary">
              <LayoutPanelTop size={24} aria-hidden="true" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              {t({ id: 'wealth.allocation.title' })}{' '}
              <span className="text-label-tertiary font-light">
                {t({ id: 'wealth.allocation.title.emphasis' })}
              </span>
            </h2>
          </div>
          <div className="px-2 md:px-4">
            <WealthAllocationBars segments={segments} />
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex items-center gap-4 px-2 md:px-4">
            <div className="p-4 rounded-xl bg-surface border border-separator text-label-secondary">
              <BarChart3 size={24} />
            </div>
            <div className="flex-1 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                  {t({ id: 'wealth.portfolio.title' })}{' '}
                  <span className="text-label-tertiary font-light">
                    {t({ id: 'wealth.portfolio.title.emphasis' })}
                  </span>
                </h2>
                {backfillResult && (
                  <p className="text-xs font-medium text-label-tertiary mt-1">
                    {backfillResult.written > 0
                      ? t(
                          { id: 'wealth.portfolio.backfill.imported' },
                          { count: backfillResult.written },
                        )
                      : t(
                          { id: 'wealth.portfolio.backfill.done' },
                          { skipped: backfillResult.skipped },
                        )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={backfillHistory}
                  disabled={portfolioBackfilling || portfolioLoading}
                  title={t({ id: 'wealth.portfolio.backfill.title' })}
                >
                  <DatabaseZap
                    size={16}
                    aria-hidden="true"
                    className={portfolioBackfilling ? 'animate-pulse' : ''}
                  />
                  <span className="hidden sm:inline">
                    {portfolioBackfilling
                      ? t({ id: 'wealth.portfolio.backfill.loading' })
                      : t({ id: 'wealth.portfolio.backfill.label' })}
                  </span>
                </Button>
                <Button
                  variant="icon"
                  size="sm"
                  onClick={refreshPortfolio}
                  title={t({ id: 'wealth.portfolio.refresh.title' })}
                  aria-label={t({ id: 'wealth.portfolio.refresh.title' })}
                >
                  <RefreshCw
                    size={18}
                    aria-hidden="true"
                    className={portfolioLoading ? 'animate-spin' : ''}
                  />
                </Button>
              </div>
            </div>
          </div>
          <div className="px-2 md:px-4">
            {!portfolioUser && !portfolioLoading ? (
              <Card
                variant="subtle"
                padding="md"
                as="button"
                onClick={portfolioLogin}
                className="w-full flex items-center justify-between hover:bg-white/5 transition-colors group cursor-pointer text-left"
              >
                <div className="flex items-center gap-4">
                  <BarChart3
                    size={20}
                    className="text-label-secondary group-hover:text-white transition-colors"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-caption font-semibold text-white">
                      {t({ id: 'wealth.portfolio.title' })}
                    </p>
                    <p className="text-caption text-label-tertiary mt-1">
                      {portfolioError
                        ? `Erreur : ${portfolioError}`
                        : 'Appuyez pour connecter SuiviPortefeuille'}
                    </p>
                  </div>
                </div>
                <div className="text-caption font-semibold text-label-secondary group-hover:text-white transition-colors">
                  Connexion →
                </div>
              </Card>
            ) : (
              <WealthPortfolioTable
                holdings={
                  ownerScope === 'all'
                    ? portfolioHoldings
                    : portfolioHoldings.filter((h) =>
                        ownerScope.some((s) => s.toLowerCase() === (h.owner || '').toLowerCase()),
                      )
                }
                loading={portfolioLoading}
                onSelectHolding={(h) =>
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
              />
            )}
          </div>
        </section>
      </div>

      <AssetDetailModal
        isOpen={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        target={detailTarget}
        placementHistory={placementHistory}
        portfolio={{
          connected: !!portfolioUser,
          login: portfolioLogin,
          txLoading: portfolioTxLoading,
          fetchTransactions: fetchPortfolioTransactions,
        }}
        onEdit={
          detailTarget && placements.some((p) => p.id === detailTarget.id)
            ? (target) => {
                setDetailTarget(null);
                setSelectedAsset({
                  id: target.id,
                  nom: target.name,
                  type: target.type,
                  owner: target.owner,
                  montant: target.currentValue,
                });
              }
            : undefined
        }
      />

      <AnimatePresence>
        {(selectedAsset || isAddingAsset) && (
          <PlacementFormModal
            placement={selectedAsset || undefined}
            previousAmount={previousAmount}
            onClose={() => {
              setSelectedAsset(null);
              setIsAddingAsset(false);
              setPreviousAmount(null);
            }}
            onSave={() => {
              refreshPortfolio();
            }}
          />
        )}
      </AnimatePresence>

      {showSnapshotModal && (
        <PlacementSnapshotModal
          placements={snapshotOptions}
          onClose={() => setShowSnapshotModal(false)}
          onOpenHistory={() => {
            setShowSnapshotModal(false);
            setShowHistoryModal(true);
          }}
        />
      )}

      {showHistoryModal && <HistoryManagementModal onClose={() => setShowHistoryModal(false)} />}

      {showImportModal && (
        <PositionsImportModal
          existingHistory={placementHistory}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
};
