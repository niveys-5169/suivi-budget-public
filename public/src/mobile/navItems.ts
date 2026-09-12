import { LayoutDashboard, Receipt, PieChart, Wallet, Shield, type LucideIcon } from 'lucide-react';

export interface MobileNavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

/**
 * Ordered list of the main mobile tabs. Single source of truth shared by the
 * bottom navigation bar and the edge-swipe navigation. The order here defines
 * the left-to-right swipe sequence: Console → Flux → Analyse → Budgets → Audit.
 */
export const NAV_ITEMS: MobileNavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Console' },
  { to: '/transactions', icon: Receipt, label: 'Flux' },
  { to: '/analyse', icon: PieChart, label: 'Analyse' },
  { to: '/budgets', icon: Wallet, label: 'Budgets' },
  { to: '/patrimoine', icon: Shield, label: 'Audit' },
];

/**
 * Maps a router pathname to its tab index in NAV_ITEMS.
 * Handles the home route exactly and sub-routes via prefix matching
 * (e.g. `/budgets/abc` → Budgets). Returns -1 when no tab matches
 * (e.g. `/qa`), which disables swipe navigation on that screen.
 */
export const getTabIndex = (pathname: string): number =>
  NAV_ITEMS.findIndex((item) =>
    item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/'),
  );
