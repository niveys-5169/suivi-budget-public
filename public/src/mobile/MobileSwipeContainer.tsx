import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { getTabIndex, NAV_ITEMS } from './navItems';
import { useEdgeSwipeNav } from './useEdgeSwipeNav';
import { HomeScreen } from './screens/HomeScreen';

// Écrans secondaires en chunks séparés (Recharts n'est plus dans le chargement
// initial), préchargés dès que le navigateur est inactif pour que le premier
// swipe vers un onglet ne montre pas le fallback.
const loadTransactions = () => import('./screens/TransactionsScreen');
const loadAnalyse = () => import('./screens/AnalyseScreen');
const loadBudgets = () => import('./screens/BudgetsScreen');
const loadPatrimoine = () => import('./screens/PatrimoineScreen');
const loadQA = () => import('./screens/QAScreen');
const TransactionsScreen = lazy(() =>
  loadTransactions().then((m) => ({ default: m.TransactionsScreen })),
);
const AnalyseScreen = lazy(() => loadAnalyse().then((m) => ({ default: m.AnalyseScreen })));
const BudgetsScreen = lazy(() => loadBudgets().then((m) => ({ default: m.BudgetsScreen })));
const PatrimoineScreen = lazy(() =>
  loadPatrimoine().then((m) => ({ default: m.PatrimoineScreen })),
);
const QAScreen = lazy(() => loadQA().then((m) => ({ default: m.QAScreen })));

const prefetchScreens = () => {
  [loadTransactions, loadBudgets, loadAnalyse, loadPatrimoine, loadQA].forEach((load) => {
    load().catch(() => {
      // Hors ligne : le chargement sera retenté à la navigation.
    });
  });
};

// Chargé à la demande : évite qu'un import statique ici n'annule le
// code-splitting déjà en place côté desktop (MainApp.tsx, AurumDashboard.tsx).
const AurumRecurringPage = lazy(() =>
  import('../components/dashboard/v2/AurumRecurringPage').then((m) => ({
    default: m.AurumRecurringPage,
  })),
);

const DesktopOnlyFallback = () => (
  <div className="flex items-center justify-center h-full p-4 text-center">
    <p className="text-body text-label-secondary">Disponible sur desktop uniquement</p>
  </div>
);

// Canonical design-system easing.
const EASE = [0.22, 1, 0.36, 1] as const;

const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '-100%' : '100%', opacity: 0 }),
};

const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Hosts the mobile routes and adds iOS-style edge-swipe navigation with an
 * animated slide transition. The slide direction tracks the tab index change,
 * so it is correct whether navigation comes from a swipe or a tap on the
 * bottom nav. Honours prefers-reduced-motion by falling back to a fade.
 */
export const MobileSwipeContainer: React.FC = () => {
  const location = useLocation();
  const { onTouchStart, onTouchEnd } = useEdgeSwipeNav();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetchScreens, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(prefetchScreens, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  const activeTab = getTabIndex(location.pathname);
  const prevIndexRef = useRef(activeTab);
  const direction = activeTab >= prevIndexRef.current ? 1 : -1;
  prevIndexRef.current = activeTab;

  // Key by tab so navigating within a tab's sub-routes (e.g. /budgets/*)
  // does not re-trigger the page slide. Off-tab routes (e.g. /qa) key by path.
  const pageKey =
    activeTab === -1 ? location.pathname : (NAV_ITEMS[activeTab]?.to ?? location.pathname);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative flex-1 min-h-0 overflow-hidden"
    >
      <AnimatePresence custom={direction} initial={false}>
        <motion.div
          key={pageKey}
          custom={direction}
          variants={reduceMotion ? fadeVariants : slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduceMotion ? 0.15 : 0.28, ease: EASE }}
          className="absolute inset-0 flex flex-col overflow-hidden"
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-8">
                <span className="text-footnote text-label-tertiary">Chargement...</span>
              </div>
            }
          >
            <Routes location={location}>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/qa" element={<QAScreen />} />
              <Route path="/transactions" element={<TransactionsScreen />} />
              <Route path="/budgets/*" element={<BudgetsScreen />} />
              <Route path="/analyse" element={<AnalyseScreen />} />
              <Route path="/patrimoine" element={<PatrimoineScreen />} />
              <Route
                path="/recurring"
                element={<AurumRecurringPage onBack={() => window.history.back()} />}
              />
              <Route path="*" element={<DesktopOnlyFallback />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
