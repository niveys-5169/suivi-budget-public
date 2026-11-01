import type { ProjectionClasseCategorie } from '../../../types/banking.types';

export const CLASS_LABELS: Record<ProjectionClasseCategorie, string> = {
  depense: 'Dépense',
  fixe: 'Crédit fixe',
  exclu: 'Exclu',
  tresorerie: 'Trésorerie',
  interne: 'Virement interne',
  revenu: 'Revenu',
  ponctuel: 'Ponctuel',
};

export const CLASS_OPTIONS = Object.keys(CLASS_LABELS) as ProjectionClasseCategorie[];

export const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];
