import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CATEGORY_ICON_COMPONENTS } from '../constants/categoryIconComponents';

const toPascalCase = (name: string) =>
  name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

/**
 * Nettoie un fragment SVG avant injection DOM pour empêcher toute exécution de script
 * (balises actives, gestionnaires d'événements inline `on*`, URLs `javascript:` / `data:text/html`).
 */
export const sanitizeSvg = (rawSvg: string): string =>
  rawSvg
    .replace(/<\s*(script|foreignObject|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|foreignObject|iframe|object|embed)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s+(?:xlink:)?href\s*=\s*(?:"\s*(?:javascript:|data:text\/html)[^"]*"|'\s*(?:javascript:|data:text\/html)[^']*'|(?:\s*(?:javascript:|data:text\/html))[^\s>]*)/gi,
      '',
    );

// Nom hors de la table statique (icône choisie avant la liste curatée) : on
// charge la bibliothèque complète à la demande plutôt qu'au démarrage. Le
// build CJS est un module distinct du barrel ESM importé en statique ailleurs ;
// `import('lucide-react')` ramènerait tout le barrel dans le chunk d'entrée.
const useLazyLucideIcon = (name: string | null): LucideIcon | null => {
  const [loaded, setLoaded] = useState<{ name: string; icon: LucideIcon | null } | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    import('lucide-react/dist/cjs/lucide-react.js')
      .then((mod) => {
        if (cancelled) return;
        const icon = (mod as unknown as Record<string, LucideIcon | undefined>)[toPascalCase(name)];
        setLoaded({ name, icon: icon ?? null });
      })
      .catch(() => {
        // Chunk indisponible (hors ligne) : on garde le rendu texte.
        if (!cancelled) setLoaded({ name, icon: null });
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return loaded && loaded.name === name ? loaded.icon : null;
};

interface CategoryIconProps {
  icon: string;
  className?: string;
  color?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  className = '',
  color,
  size = 20,
}) => {
  const isSvg = !!icon && icon.trim().startsWith('<svg');
  const StaticIcon =
    icon && !isSvg ? CATEGORY_ICON_COMPONENTS[icon.toLowerCase().replace(/_/g, '-')] : undefined;
  const lazyName = icon && !isSvg && !StaticIcon && /^[a-z0-9_-]+$/i.test(icon) ? icon : null;
  const LazyIcon = useLazyLucideIcon(lazyName);

  if (!icon) return <div className={className}>📦</div>;

  if (isSvg) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ color: color || 'currentColor' }}
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(icon) }}
      />
    );
  }

  const LucideIcon = StaticIcon ?? LazyIcon;

  if (LucideIcon) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {React.createElement(LucideIcon, { size, color })}
      </div>
    );
  }

  return <div className={`flex items-center justify-center ${className}`}>{icon}</div>;
};
