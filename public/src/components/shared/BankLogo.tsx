import React from 'react';
import { getBankBranding } from '../../constants/bankBranding';
import lclLogo from '../../assets/banks/lcl.svg';
import bforbankLogo from '../../assets/banks/bforbank.svg';

/**
 * Logos officiels servis en local (src/assets/banks/), pour ne pas dépendre
 * de CDN tiers à l'affichage. Clé = fragment détecté dans le nom du compte.
 *
 * Importés en modules ES (pas une chaîne d'URL brute) pour que Vite les
 * inclue dans le build : avec `root: 'public'`, un chemin en dur comme
 * `/assets/banks/lcl.svg` n'est copié dans `dist/` par aucun mécanisme —
 * seuls les assets référencés via `import` ou vivant dans le `publicDir`
 * (absent ici) le sont.
 *
 * `fit` distingue deux familles de fichiers : les icônes carrées avec leur
 * propre fond plein (LCL) doivent couvrir toute la tuile, tandis que les
 * logotypes horizontaux sur fond transparent (BforBank) ont besoin d'une
 * marge et d'un fond clair pour rester lisibles.
 */
const OFFICIAL_LOGOS: Record<string, { src: string; label: string; fit: 'cover' | 'contain' }> = {
  lcl: { src: lclLogo, label: 'LCL', fit: 'cover' },
  bforbank: { src: bforbankLogo, label: 'BforBank', fit: 'contain' },
};

/**
 * Icône de banque : tuile carrée arrondie (comme une icône d'app), avec le
 * logo officiel pour LCL/BforBank ou des initiales sur fond teinté en repli.
 * Le carré évite le décalage de forme qu'un cercle imposait à un logo carré
 * (LCL) ou à un logotype rectangulaire (BforBank).
 * Utilisée dans la liste des comptes.
 */
export const BankLogo: React.FC<{
  /** Nom du compte ou de la banque (sert à la détection de la marque). */
  name: string;
  /** Côté de la tuile en pixels (défaut 44). */
  size?: number;
  className?: string;
}> = ({ name, size = 44, className = '' }) => {
  const lowerName = name.toLowerCase();
  const officialLogo = Object.entries(OFFICIAL_LOGOS).find(([key]) => lowerName.includes(key))?.[1];
  const radius = Math.round(size * 0.3);
  if (officialLogo) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden border border-separator bg-white ${className}`}
        style={{ width: size, height: size, borderRadius: radius }}
      >
        <img
          src={officialLogo.src}
          alt={`Logo ${officialLogo.label}`}
          style={{
            width: officialLogo.fit === 'cover' ? '100%' : '72%',
            height: officialLogo.fit === 'cover' ? '100%' : '72%',
            objectFit: officialLogo.fit,
          }}
        />
      </div>
    );
  }
  // fallback aux initiales
  const { short, color } = getBankBranding(name);
  return (
    <div
      className={`flex items-center justify-center border font-semibold tabular-nums select-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: `${color}1A`, // ~10% opacité
        borderColor: `${color}59`, // ~35% opacité
        color,
        fontSize: Math.round(size * 0.32),
        letterSpacing: '0.02em',
      }}
      aria-hidden="true"
    >
      {short}
    </div>
  );
};
