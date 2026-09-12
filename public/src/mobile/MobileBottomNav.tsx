import React from 'react';
import { NAV_ITEMS } from './navItems';
import { TabBar } from '../ui';

/**
 * Onglets principaux de la PWA.
 *
 * Le rendu est désormais partagé avec le desktop via <TabBar>. Les deux barres
 * coexistaient avec des hauteurs (60 px ici, 64 px côté desktop) et des styles
 * différents, ce qui rendait la parité PWA/web impossible à tenir.
 *
 * `mobileOnly={false}` : cette barre vit déjà dans le shell mobile, elle ne
 * doit pas se masquer elle-même au-delà du breakpoint.
 */
export const MobileBottomNav: React.FC = () => (
  <TabBar items={NAV_ITEMS} mobileOnly={false} className="static shrink-0" />
);
