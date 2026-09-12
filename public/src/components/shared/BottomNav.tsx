import React from 'react';
import { useIntl } from 'react-intl';
import { LayoutDashboard, ArrowLeftRight, BarChart3, TrendingUp, PieChart } from 'lucide-react';
import { FLAGS } from '../../lib/featureFlags';
import { TabBar, type TabItem } from '../../ui';
import type { MessageId } from '../../i18n/messages/fr';

/**
 * Onglets principaux du desktop en largeur mobile.
 *
 * Ne fait plus que fournir les libellés traduits à <TabBar>. Le rendu est
 * partagé avec la PWA : les deux barres avaient auparavant des hauteurs
 * différentes (64 px ici, 60 px côté mobile), des styles distincts et des
 * libellés en capitales d'un côté, en dur de l'autre.
 *
 * Cinq onglets au maximum : au-delà les libellés ne tiennent plus sur la
 * largeur d'un iPhone. L'Assistant (/qa) et le Lab (/advanced) restent
 * accessibles par la Sidebar sur desktop et par URL directe sur mobile.
 */
export const BottomNav: React.FC = () => {
  const { formatMessage: t } = useIntl();

  const entries: { to: string; icon: TabItem['icon']; labelId: MessageId }[] = [
    { to: '/', icon: LayoutDashboard, labelId: 'nav.console' },
    { to: '/transactions', icon: ArrowLeftRight, labelId: 'nav.flux' },
    { to: '/budgets', icon: BarChart3, labelId: 'nav.budgets' },
    { to: '/patrimoine', icon: TrendingUp, labelId: 'nav.audit' },
  ];

  if (FLAGS.ANALYSE_PAGE) {
    entries.splice(2, 0, { to: '/analyse', icon: PieChart, labelId: 'nav.analyse' });
  }

  const items: TabItem[] = entries.map(({ to, icon, labelId }) => ({
    to,
    icon,
    label: t({ id: labelId }),
  }));

  return <TabBar items={items} />;
};
