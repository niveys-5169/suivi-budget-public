import React from 'react';
import { NavLink } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  TrendingUp,
  PieChart,
  FlaskConical,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { FLAGS } from '../../lib/featureFlags';
import { LogoutButton } from '../AuthButtons';
import { Text, Separator } from '../../ui';
import type { MessageId } from '../../i18n/messages/fr';

type NavEntry = { to: string; icon: typeof LayoutDashboard; labelId: MessageId };

/** Ligne de navigation. 44 px de haut, rayon 10 — comme un contrôle. */
const SidebarLink: React.FC<{ to: string; icon: typeof LayoutDashboard; label: string }> = ({
  to,
  icon: Icon,
  label,
}) => (
  <NavLink
    to={to}
    end={to === '/'}
    className={({ isActive }) =>
      [
        'density-nav flex min-h-11 items-center gap-4 rounded-md px-4 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        isActive ? 'bg-gold-subtle text-gold' : 'text-label-secondary hover:bg-raised',
      ].join(' ')
    }
  >
    {({ isActive }) => (
      <>
        <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
        <span className="text-callout font-semibold">{label}</span>
      </>
    )}
  </NavLink>
);

export const Sidebar: React.FC = () => {
  const { formatMessage: t } = useIntl();

  const items: NavEntry[] = [
    { to: '/', icon: LayoutDashboard, labelId: 'nav.console' },
    { to: '/transactions', icon: ArrowLeftRight, labelId: 'nav.flux' },
    { to: '/budgets', icon: BarChart3, labelId: 'nav.budgets' },
    { to: '/recurring', icon: RefreshCw, labelId: 'nav.recurring' },
    { to: '/patrimoine', icon: TrendingUp, labelId: 'nav.audit' },
  ];

  if (FLAGS.ANALYSE_PAGE) {
    items.splice(2, 0, { to: '/analyse', icon: PieChart, labelId: 'nav.analyse' });
  }

  return (
    <aside
      aria-label={t({ id: 'nav.sidebar.aria' })}
      className="no-scrollbar sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-separator bg-bg md:flex"
    >
      <div className="px-4 py-6">
        <Text
          variant="title2"
          tone="accent"
          className="font-serif"
          aria-label={t({ id: 'nav.sidebar.aria.brand' })}
        >
          {t({ id: 'nav.sidebar.title' })}
        </Text>
        <Text variant="footnote" tone="tertiary" aria-hidden="true">
          {t({ id: 'nav.sidebar.subtitle' })}
        </Text>
      </div>

      <nav aria-label={t({ id: 'nav.sidebar.main.aria' })} className="flex flex-col gap-1 px-2">
        {items.map((item) => (
          <SidebarLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={t({ id: item.labelId })}
          />
        ))}
      </nav>

      <nav
        aria-label={t({ id: 'nav.sidebar.tools.aria' })}
        className="mt-auto flex flex-col gap-1 px-2 pb-4"
      >
        <SidebarLink to="/qa" icon={MessageSquare} label={t({ id: 'nav.assistant' })} />
        <SidebarLink to="/advanced" icon={FlaskConical} label={t({ id: 'nav.lab' })} />
      </nav>

      <Separator />
      <div className="flex flex-col items-center gap-4 p-6">
        <Text variant="caption" tone="tertiary">
          {t({ id: 'nav.sidebar.version' })}
        </Text>
        <LogoutButton />
      </div>
    </aside>
  );
};
