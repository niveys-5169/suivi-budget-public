import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const APP_TITLE = 'AURUM — Suivi Budget';

/** Libellé de page par chemin (correspondance exacte pour la racine, préfixe sinon). */
const PAGE_LABELS: [string, string][] = [
  ['/', 'Tableau de bord'],
  ['/transactions', 'Transactions'],
  ['/analyse', 'Analyse'],
  ['/budgets', 'Budgets'],
  ['/recurring', 'Récurrences'],
  ['/patrimoine', 'Patrimoine'],
  ['/projections', 'Projections'],
  ['/qa', 'Assistant'],
  ['/settings', 'Paramètres'],
  ['/connexions', 'Connexions bancaires'],
  ['/notifications', 'Notifications'],
  ['/semaine', 'Ma semaine'],
  ['/journal', 'Journal'],
  ['/rules', 'Règles'],
  ['/mappings', 'Correspondances'],
  ['/fusion', 'Fusion'],
  ['/reparse', 'Réanalyse'],
  ['/excluded', 'Emails exclus'],
  ['/tronity', 'Tronity'],
];

export function getPageTitle(pathname: string): string {
  const entry = PAGE_LABELS.find(([path]) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/'),
  );
  return entry ? `« ${entry[1]} — AURUM »` : APP_TITLE;
}

/** Met à jour `document.title` à chaque changement de page. */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = getPageTitle(pathname);
  }, [pathname]);
}
