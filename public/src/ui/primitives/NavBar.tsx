import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Text } from './Text';
import { IconButton } from './Button';

interface NavBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Actions à droite — des <IconButton variant="plain"> en général. */
  actions?: React.ReactNode;
  /** Reste collée en haut au défilement. */
  sticky?: boolean;
  className?: string;
}

/**
 * Barre de navigation d'écran. 56 px, titre en casse normale.
 *
 * Remplace trois implémentations divergentes : shared/PageHeader (titre en
 * capitales + filet doré décoratif), mobile/MScreenHeader (sans bouton retour
 * ni safe-area) et le header réécrit à la main dans BankinBudgetsContainer.
 *
 * La marge négative annule le `pt-safe` du conteneur parent tout en gardant le
 * titre sous la barre d'état, en flux comme en position collée.
 */
export const NavBar: React.FC<NavBarProps> = ({
  title,
  subtitle,
  onBack,
  actions,
  sticky = true,
  className = '',
}) => (
  <div
    className={[
      sticky ? 'sticky top-0 z-sticky' : '',
      'bg-bg/90 backdrop-blur-xl border-b border-separator',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    style={{
      marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}
  >
    <div className="density-navbar flex min-h-14 items-center justify-between gap-2 px-4">
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          <IconButton label="Retour" variant="plain" size="sm" onClick={onBack} className="-ml-2">
            <ArrowLeft size={22} aria-hidden="true" />
          </IconButton>
        )}
        <div className="min-w-0">
          <Text as="h1" variant="title3" truncate>
            {title}
          </Text>
          {subtitle && (
            <Text variant="footnote" tone="tertiary" truncate>
              {subtitle}
            </Text>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  </div>
);

interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Se colle sous la NavBar. */
  sticky?: boolean;
}

/**
 * Bandeau de contrôles sous la NavBar : filtres, navigation de période,
 * segmented control. Sans bordure — c'est l'espace qui sépare.
 */
export const Toolbar: React.FC<ToolbarProps> = ({
  sticky = false,
  className = '',
  children,
  ...props
}) => (
  <div
    className={[
      sticky ? 'sticky top-below-header z-nav bg-bg/90 backdrop-blur-xl' : '',
      'density-toolbar flex items-center gap-2 px-4 py-2',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  >
    {children}
  </div>
);
