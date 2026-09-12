import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { FLAGS } from './lib/featureFlags';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { isIOSLoginTab } from './components/AuthButtons';
import { BottomNav } from './components/shared/BottomNav';
import { Sidebar } from './components/layout/Sidebar';
import { hideLoader } from './utils/loader';
import { Toast } from './components/Toast';
import { ConfirmHost } from './components/ConfirmHost';
import { AriaLiveRegion } from './components/shared/AriaLiveRegion';
import { OfflineBanner } from './components/shared/OfflineBanner';
import { PageLayout } from './components/shared/PageLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

// ─── Route code-splitting ─────────────────────────────────────────────────────
// DashboardSection is the landing route — kept eager so the first paint has no
// Suspense flash. All other sections are lazy-loaded into separate chunks so
// their dependencies (Recharts, Chart.js, DnD Kit, Firebase listeners) are
// excluded from the initial bundle.
import { DashboardSection } from './components/DashboardSection';

// New opt-in UI (JourX-inspired). Lazy so its chunk stays out of the default bundle.

const TransactionsSection = lazy(() =>
  import('./components/TransactionsSection').then((m) => ({ default: m.TransactionsSection })),
);
const BudgetsV2Section = lazy(() =>
  import('./components/budgets-v2/BudgetsV2Section').then((m) => ({ default: m.BudgetsV2Section })),
);
const PatrimoineSection = lazy(() =>
  import('./components/PatrimoineSection').then((m) => ({ default: m.PatrimoineSection })),
);
const FinanceQASection = lazy(() =>
  import('./components/FinanceQASection').then((m) => ({ default: m.FinanceQASection })),
);
const AdvancedSettings = lazy(() =>
  import('./components/AdvancedSettings').then((m) => ({ default: m.AdvancedSettings })),
);
const AnalyseSection = lazy(() =>
  import('./components/analyse/AnalyseSection').then((m) => ({ default: m.AnalyseSection })),
);

// Advanced sub-pages — each lives in its own file and lazy chunk.
const TronityPage = lazy(() =>
  import('./components/advanced/TronityPage').then((m) => ({ default: m.TronityPage })),
);
const MappingsPage = lazy(() =>
  import('./components/advanced/MappingsPage').then((m) => ({ default: m.MappingsPage })),
);
const FusionPage = lazy(() =>
  import('./components/advanced/FusionPage').then((m) => ({ default: m.FusionPage })),
);
const ReparsePage = lazy(() =>
  import('./components/advanced/ReparsePage').then((m) => ({ default: m.ReparsePage })),
);
const ExcludedEmailsPage = lazy(() =>
  import('./components/advanced/ExcludedEmailsPage').then((m) => ({
    default: m.ExcludedEmailsPage,
  })),
);
const RulesPage = lazy(() =>
  import('./components/advanced/RulesPage').then((m) => ({ default: m.RulesPage })),
);
const AurumRecurringPage = lazy(() =>
  import('./components/dashboard/v2/AurumRecurringPage').then((m) => ({
    default: m.AurumRecurringPage,
  })),
);

// ─── Shell components ─────────────────────────────────────────────────────────
const RouteSpinner: React.FC = () => {
  const { formatMessage: t } = useIntl();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="w-12 h-12 border-4 border-label/20 border-t-platinum rounded-full animate-spin" />
      <p className="text-caption font-semibold text-label animate-pulse">
        {t({ id: 'state.loading.short' })}
      </p>
    </div>
  );
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export const MainApp: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { formatMessage: t } = useIntl();
  const iosLoginTab = isIOSLoginTab();

  useEffect(() => {
    if (authLoading) return;

    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      if (user) {
        loginScreen.classList.add('hidden');
        loginScreen.classList.remove('flex');
      } else {
        loginScreen.classList.remove('hidden');
        loginScreen.classList.add('flex');
      }
    }

    hideLoader();
  }, [user, authLoading]);

  useEffect(() => {
    if (FLAGS.BOTTOMNAV_V2) {
      const legacyNav = document.getElementById('legacy-mobile-nav');
      if (legacyNav) legacyNav.style.display = 'none';

      const topBalances = document.getElementById('top-balances');
      if (topBalances) topBalances.style.display = 'none';
    }
  }, []);

  // Apply `data-density` on <html> so density-aware CSS rules (see tailwind.css)
  // can opt in components into a more compact spacing/typography.
  useEffect(() => {
    const apply = (density: string) => {
      document.documentElement.dataset.density = density === 'compact' ? 'compact' : 'comfortable';
    };
    apply(localStorage.getItem('ui_density') || 'comfortable');

    const onChange = (event: Event) => {
      const next = (event as CustomEvent<{ density: string }>).detail?.density;
      if (next) apply(next);
    };
    window.addEventListener('density-change', onChange);
    return () => window.removeEventListener('density-change', onChange);
  }, []);

  // When opened from the standalone app for auth, show "return to app" after sign-in
  if (iosLoginTab && user && !authLoading) {
    return (
      <div className="fixed inset-0 bg-[#0B0B14] flex items-center justify-center p-8 text-center">
        <div className="space-y-6 max-w-xs">
          <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gold"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-gold font-semibold text-sm">{t({ id: 'auth.ios.success' })}</p>
          <p className="text-label-secondary text-xs leading-relaxed">
            {t({ id: 'auth.ios.returnToApp' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Skip-link — keyboard users jump directly to main content (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-modal focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-callout focus:font-semibold focus:text-bg"
      >
        {t({ id: 'shell.skipLink' })}
      </a>
      <div className="flex min-h-screen bg-bg">
        <ScrollToTop />
        <Sidebar />
        <main id="main-content" className="flex-1 min-w-0 overflow-x-clip pt-safe pb-0">
          <PageLayout>
            <ErrorBoundary label="Page">
              <Suspense fallback={<RouteSpinner />}>
                <Routes>
                  <Route path="/" element={<DashboardSection />} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                  <Route path="/transactions" element={<TransactionsSection />} />
                  <Route path="/budgets/*" element={<BudgetsV2Section />} />
                  <Route path="/patrimoine" element={<PatrimoineSection />} />
                  <Route path="/qa" element={<FinanceQASection />} />
                  <Route path="/advanced" element={<AdvancedSettings />} />

                  {/* Advanced sub-pages — all resolved from the same lazy chunk */}
                  <Route path="/tronity" element={<TronityPage />} />
                  <Route path="/mappings" element={<MappingsPage />} />
                  <Route path="/fusion" element={<FusionPage />} />
                  <Route path="/rav-config" element={<Navigate to="/budgets" replace />} />
                  <Route path="/reparse" element={<ReparsePage />} />
                  <Route path="/excluded" element={<ExcludedEmailsPage />} />
                  <Route path="/rules" element={<RulesPage />} />
                  <Route
                    path="/recurring"
                    element={<AurumRecurringPage onBack={() => window.history.back()} />}
                  />

                  {/* Legacy path stubs — prevent 404 redirects during migration */}
                  <Route path="/budget" element={null} />
                  <Route path="/budgets-v2" element={null} />

                  {FLAGS.ANALYSE_PAGE && <Route path="/analyse" element={<AnalyseSection />} />}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </PageLayout>
        </main>
        <OfflineBanner />
        {FLAGS.BOTTOMNAV_V2 && <BottomNav />}
        <Toast />
        <ConfirmHost />
        <AriaLiveRegion />
      </div>
    </>
  );
};
