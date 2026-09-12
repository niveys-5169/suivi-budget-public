import React from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';

export interface TabItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface TabBarProps {
  items: readonly TabItem[];
  /** Masque la barre au-delà du breakpoint mobile. */
  mobileOnly?: boolean;
  className?: string;
}

/**
 * Barre d'onglets principale. 56 px + safe-area.
 *
 * Fusionne shared/BottomNav (libellés i18n, hauteur 64 px, capitales, ombre
 * portée et pastille dorée) et mobile/MobileBottomNav (libellés français en
 * dur, hauteur 60 px). Les deux coexistaient avec des hauteurs et des styles
 * différents ; les libellés passent en casse normale.
 */
export const TabBar: React.FC<TabBarProps> = ({ items, mobileOnly = true, className = '' }) => {
  const { light } = useHaptics();

  return (
    <nav
      aria-label="Navigation principale"
      className={[
        'fixed inset-x-0 bottom-0 z-nav border-t border-separator bg-bg/90 backdrop-blur-xl',
        mobileOnly ? 'md:hidden' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-14">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onPointerDown={light}
            className={({ isActive }) =>
              [
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset',
                isActive ? 'text-gold' : 'text-label-tertiary hover:text-label-secondary',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={22} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                <span className="w-full truncate px-1 text-center text-caption leading-none">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
